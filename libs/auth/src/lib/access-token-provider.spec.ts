/**
 * Access-token integration tests for Sub-Phase 2.5.
 *
 * Proves the acceptance criterion against the real interceptor pipeline
 * (no live backend — `HttpTestingController` stands in for the API):
 * any authenticated request carries the session token with no
 * feature-level header code, while anonymous requests pass through with
 * no `Authorization` header at all.
 */

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ACCESS_TOKEN_PROVIDER, ApiClient, provideApi, provideAppEnvironment } from '@flux/api';
import { AuthService, type CurrentUser } from '@flux/auth';
import { provideAccessToken } from './access-token-provider';

const USER: CurrentUser = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'ada@flux.local',
  displayName: 'Ada Lovelace',
  roles: ['Customer'],
  isEmailVerified: true,
};

function setup(): {
  client: ApiClient;
  auth: AuthService;
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
      provideHttpClientTesting(),
      { provide: Router, useValue: { navigateByUrl: () => Promise.resolve(true) } },
    ],
  });
  return {
    client: TestBed.inject(ApiClient),
    auth: TestBed.inject(AuthService),
    http: TestBed.inject(HttpTestingController),
  };
}

describe('ACCESS_TOKEN_PROVIDER wiring', () => {
  let client: ApiClient;
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    ({ client, auth, http } = setup());
  });

  afterEach(() => {
    http.verify();
  });

  it('reads null while anonymous', () => {
    expect(TestBed.inject(ACCESS_TOKEN_PROVIDER)()).toBeNull();

    client.get<void>('/auth/me').subscribe();
    const request = http.expectOne('https://localhost:7119/auth/me');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(null);
  });

  it('attaches the session token to every request once authenticated', () => {
    auth.setAuthenticated({ user: USER, accessToken: 'access-token-1' });
    expect(TestBed.inject(ACCESS_TOKEN_PROVIDER)()).toBe('access-token-1');

    client.get<void>('/auth/me').subscribe();
    const first = http.expectOne('https://localhost:7119/auth/me');
    expect(first.request.headers.get('Authorization')).toBe('Bearer access-token-1');
    first.flush(null);

    client.get<void>('/orders/missing').subscribe();
    const second = http.expectOne('https://localhost:7119/orders/missing');
    expect(second.request.headers.get('Authorization')).toBe('Bearer access-token-1');
    second.flush(null);
  });

  it('follows token replacement without re-registration', () => {
    auth.setAuthenticated({ user: USER, accessToken: 'access-token-1' });
    auth.replaceAccessToken('access-token-2');

    client.get<void>('/auth/me').subscribe();
    const request = http.expectOne('https://localhost:7119/auth/me');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-token-2');
    request.flush(null);
  });

  it('stops attaching after the session clears', () => {
    auth.setAuthenticated({ user: USER, accessToken: 'access-token-1' });
    auth.clearSession();
    expect(TestBed.inject(ACCESS_TOKEN_PROVIDER)()).toBeNull();

    client.get<void>('/auth/me').subscribe();
    const request = http.expectOne('https://localhost:7119/auth/me');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(null);
  });
});
