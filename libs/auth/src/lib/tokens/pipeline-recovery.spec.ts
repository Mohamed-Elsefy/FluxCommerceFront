/**
 * End-to-end pipeline recovery tests for Sub-Phase 2.14.
 *
 * Exercises the COMPLETE production chain with nothing stubbed —
 * `ApiClient` → interceptors (recovery + injection + normalization) →
 * `TokenRefreshService` → `AuthService`/`TokenStorageService` — against
 * `HttpTestingController`. Proves the plan's concurrency contract:
 * simultaneous 401s collapse into one refresh POST, every original request
 * retries once with the rotated token, and unrecoverable failures clean up
 * without further traffic.
 */

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiClient, ApiError, provideApi, provideAppEnvironment } from '@flux/api';
import {
  AuthService,
  TokenStorageService,
  provideAccessToken,
  provideAuthRecovery,
  type CurrentUser,
} from '@flux/auth';

const USER: CurrentUser = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'ada@flux.local',
  displayName: 'Ada Lovelace',
  roles: ['Customer'],
  isEmailVerified: true,
};

const AUTHENTICATED_AT = '2026-09-06T12:00:00.000Z';

const ROTATED_PAIR = {
  userId: USER.id,
  email: USER.email,
  roles: ['Customer'],
  accessToken: 'access-token-2',
  refreshToken: 'refresh-token-2',
  refreshTokenExpiresAtUtc: '2026-09-13T12:00:00Z',
};

function unauthorized(detail: string): Record<string, unknown> {
  return {
    type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
    title: 'Unauthorized',
    status: 401,
    detail,
    extensions: {},
  };
}

function setup(): {
  client: ApiClient;
  auth: AuthService;
  storage: TokenStorageService;
  http: HttpTestingController;
} {
  TestBed.configureTestingModule({
    providers: [
      provideAppEnvironment({
        name: 'development',
        production: false,
        appName: 'test',
        apiBaseUrl: 'https://localhost:7119',
      }),
      provideApi(),
      provideAccessToken(),
      provideAuthRecovery(),
      provideHttpClientTesting(),
    ],
  });
  window.localStorage.clear();
  return {
    client: TestBed.inject(ApiClient),
    auth: TestBed.inject(AuthService),
    storage: TestBed.inject(TokenStorageService),
    http: TestBed.inject(HttpTestingController),
  };
}

function seedSession(auth: AuthService, storage: TokenStorageService): void {
  auth.setAuthenticated({
    user: USER,
    accessToken: 'expired-token-1',
    authenticatedAtUtc: AUTHENTICATED_AT,
  });
  storage.saveSession({
    refreshToken: 'refresh-token-1',
    user: USER,
    authenticatedAtUtc: AUTHENTICATED_AT,
  });
}

describe('authenticated pipeline recovery (2.14)', () => {
  let client: ApiClient;
  let auth: AuthService;
  let storage: TokenStorageService;
  let http: HttpTestingController;

  beforeEach(() => {
    ({ client, auth, storage, http } = setup());
  });

  afterEach(() => {
    http.verify();
  });

  it('collapses concurrent 401s into one refresh and retries all with the new token', () => {
    seedSession(auth, storage);
    const results: unknown[] = [];
    const errors: unknown[] = [];
    for (let index = 0; index < 3; index += 1) {
      client.get<unknown>(`/orders/${index}`).subscribe({
        next: (body) => results.push(body),
        error: (error: unknown) => errors.push(error),
      });
    }

    const expired = [0, 1, 2].map((index) =>
      http.expectOne(`https://localhost:7119/orders/${index}`),
    );
    for (const pending of expired) {
      expect(pending.request.headers.get('Authorization')).toBe('Bearer expired-token-1');
      pending.flush(unauthorized('Access token expired.'), {
        status: 401,
        statusText: 'Unauthorized',
      });
    }

    const refresh = http.expectOne('https://localhost:7119/auth/refresh');
    expect(refresh.request.body).toEqual({ refreshToken: 'refresh-token-1' });
    refresh.flush({ isSuccess: true, data: ROTATED_PAIR });

    const retried = [0, 1, 2].map((index) =>
      http.expectOne(`https://localhost:7119/orders/${index}`),
    );
    retried.forEach((request, index) => {
      expect(request.request.headers.get('Authorization')).toBe('Bearer access-token-2');
      request.flush({ isSuccess: true, data: { orderId: index } });
    });

    expect(errors).toHaveLength(0);
    expect(results).toHaveLength(3);
    expect(auth.readAccessToken()).toBe('access-token-2');
    expect(storage.loadSession()?.refreshToken).toBe('refresh-token-2');
  });

  it('cleans up on unrecoverable refresh without further traffic', () => {
    seedSession(auth, storage);
    const errors: unknown[] = [];
    for (let index = 0; index < 2; index += 1) {
      client.get<unknown>(`/orders/${index}`).subscribe({
        error: (error: unknown) => errors.push(error),
      });
    }

    for (const index of [0, 1]) {
      http.expectOne(`https://localhost:7119/orders/${index}`).flush(unauthorized('Expired.'), {
        status: 401,
        statusText: 'Unauthorized',
      });
    }
    http.expectOne('https://localhost:7119/auth/refresh').flush(unauthorized('Revoked.'), {
      status: 401,
      statusText: 'Unauthorized',
    });

    expect(errors).toHaveLength(2);
    for (const error of errors) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(401);
      expect((error as ApiError).message).toBe('Expired.');
    }
    expect(storage.loadSession()).toBeNull();
    expect(auth.isAnonymous()).toBe(true);
    expect(auth.readAccessToken()).toBeNull();
  });
});
