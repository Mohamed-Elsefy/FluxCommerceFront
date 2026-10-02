/**
 * Recovery provider wiring tests for Sub-Phase 2.7.
 *
 * Proves `provideAuthRecovery()` binds the seam to the single-flight
 * refresh lifecycle: a seeded session rotates through one refresh POST,
 * and a missing session declines without any HTTP.
 */

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AUTH_RECOVERY_PROVIDER, provideApi, provideAppEnvironment } from '@flux/api';
import { AuthService, TokenStorageService, type CurrentUser } from '@flux/auth';
import { provideAuthRecovery } from './auth-recovery';

const USER: CurrentUser = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'ada@flux.local',
  displayName: 'Ada Lovelace',
  roles: ['Customer'],
  permissions: [],
  isEmailVerified: true,
};

function setup(): { http: HttpTestingController } {
  TestBed.configureTestingModule({
    providers: [
      provideAppEnvironment({
        name: 'development',
        production: false,
        appName: 'test',
        apiBaseUrl: 'https://localhost:7119',
      }),
      provideApi(),
      provideAuthRecovery(),
      provideHttpClientTesting(),
    ],
  });
  window.localStorage.clear();
  return { http: TestBed.inject(HttpTestingController) };
}

describe('provideAuthRecovery', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    ({ http } = setup());
  });

  afterEach(() => {
    http.verify();
  });

  it('rotates through the seam when a session is stored', () => {
    const auth = TestBed.inject(AuthService);
    const storage = TestBed.inject(TokenStorageService);
    auth.setAuthenticated({
      user: USER,
      accessToken: 'access-token-1',
      authenticatedAtUtc: '2026-09-06T12:00:00.000Z',
    });
    storage.saveSession({
      refreshToken: 'refresh-token-1',
      user: USER,
      authenticatedAtUtc: '2026-09-06T12:00:00.000Z',
    });

    let outcome: boolean | undefined;
    TestBed.inject(AUTH_RECOVERY_PROVIDER)().subscribe((refreshed) => {
      outcome = refreshed;
    });

    const request = http.expectOne('https://localhost:7119/auth/refresh');
    expect(request.request.body).toEqual({ refreshToken: 'refresh-token-1' });
    request.flush({
      isSuccess: true,
      data: {
        userId: USER.id,
        email: USER.email,
        roles: ['Customer'],
        accessToken: 'access-token-2',
        refreshToken: 'refresh-token-2',
        refreshTokenExpiresAtUtc: '2026-09-13T12:00:00Z',
      },
    });

    expect(outcome).toBe(true);
    expect(auth.readAccessToken()).toBe('access-token-2');
  });

  it('declines without HTTP when no session is stored', () => {
    let outcome: boolean | undefined;
    TestBed.inject(AUTH_RECOVERY_PROVIDER)().subscribe((refreshed) => {
      outcome = refreshed;
    });

    http.expectNone('https://localhost:7119/auth/refresh');
    expect(outcome).toBe(false);
  });
});
