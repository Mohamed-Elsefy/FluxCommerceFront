/**
 * Refresh lifecycle tests for Sub-Phase 2.6.
 *
 * The real `IdentityApiService` → `ApiClient` chain runs against
 * `HttpTestingController` (no live backend) to prove the wire-level
 * guarantees: exactly one refresh POST per burst no matter how many
 * callers join, rotated-pair propagation, cleanup on failure, no
 * resurrection after logout, and refresh-endpoint identification for the
 * 2.7 pipeline.
 */

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiClient, provideApi, provideAppEnvironment } from '@flux/api';
import { AuthService, TokenStorageService, type CurrentUser } from '@flux/auth';
import { TokenRefreshService, isRefreshRequest } from './token-refresh.service';

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

function setup(): {
  refresher: TokenRefreshService;
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
      provideHttpClientTesting(),
    ],
  });
  window.localStorage.clear();
  // ApiClient is unused directly; injecting it proves the shared pipeline
  // (interceptors included) is the transport under test.
  TestBed.inject(ApiClient);
  return {
    refresher: TestBed.inject(TokenRefreshService),
    auth: TestBed.inject(AuthService),
    storage: TestBed.inject(TokenStorageService),
    http: TestBed.inject(HttpTestingController),
  };
}

function seedSession(auth: AuthService, storage: TokenStorageService): void {
  auth.setAuthenticated({
    user: USER,
    accessToken: 'access-token-1',
    authenticatedAtUtc: AUTHENTICATED_AT,
  });
  storage.saveSession({
    refreshToken: 'refresh-token-1',
    user: USER,
    authenticatedAtUtc: AUTHENTICATED_AT,
  });
}

describe('TokenRefreshService', () => {
  let refresher: TokenRefreshService;
  let auth: AuthService;
  let storage: TokenStorageService;
  let http: HttpTestingController;

  beforeEach(() => {
    ({ refresher, auth, storage, http } = setup());
  });

  afterEach(() => {
    http.verify();
  });

  it('rotates the pair and propagates it to memory and storage', () => {
    seedSession(auth, storage);
    let outcome: boolean | undefined;
    refresher.refreshSession().subscribe((refreshed) => {
      outcome = refreshed;
    });

    const request = http.expectOne('https://localhost:7119/auth/refresh');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ refreshToken: 'refresh-token-1' });
    request.flush({ isSuccess: true, data: ROTATED_PAIR });

    expect(outcome).toBe(true);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.readAccessToken()).toBe('access-token-2');
    expect(storage.loadSession()).toEqual({
      refreshToken: 'refresh-token-2',
      user: USER,
      authenticatedAtUtc: AUTHENTICATED_AT,
    });
  });

  it('dispatches one refresh for concurrent callers and shares the outcome', () => {
    seedSession(auth, storage);
    const outcomes: boolean[] = [];
    refresher.refreshSession().subscribe((refreshed) => outcomes.push(refreshed));
    refresher.refreshSession().subscribe((refreshed) => outcomes.push(refreshed));
    refresher.refreshSession().subscribe((refreshed) => outcomes.push(refreshed));

    http.expectOne('https://localhost:7119/auth/refresh').flush({
      isSuccess: true,
      data: ROTATED_PAIR,
    });

    expect(outcomes).toEqual([true, true, true]);
    expect(auth.readAccessToken()).toBe('access-token-2');
  });

  it('starts a fresh execution after the previous one terminates', () => {
    seedSession(auth, storage);
    refresher.refreshSession().subscribe();
    http.expectOne('https://localhost:7119/auth/refresh').flush({
      isSuccess: true,
      data: ROTATED_PAIR,
    });

    let second: boolean | undefined;
    refresher.refreshSession().subscribe((refreshed) => {
      second = refreshed;
    });
    const retry = http.expectOne('https://localhost:7119/auth/refresh');
    expect(retry.request.body).toEqual({ refreshToken: 'refresh-token-2' });
    retry.flush({ isSuccess: true, data: { ...ROTATED_PAIR, accessToken: 'access-token-3' } });

    expect(second).toBe(true);
    expect(auth.readAccessToken()).toBe('access-token-3');
  });

  it('clears state on refresh failure without internal retries', () => {
    seedSession(auth, storage);
    const outcomes: boolean[] = [];
    refresher.refreshSession().subscribe((refreshed) => outcomes.push(refreshed));
    refresher.refreshSession().subscribe((refreshed) => outcomes.push(refreshed));

    http.expectOne('https://localhost:7119/auth/refresh').flush(
      {
        type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid refresh token.',
        extensions: {},
      },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(outcomes).toEqual([false, false]);
    expect(storage.loadSession()).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.isAnonymous()).toBe(true);
    expect(auth.currentUser()).toBeNull();
    expect(auth.readAccessToken()).toBeNull();
  });

  it('fails closed with no stored token and issues no request', () => {
    auth.setAuthenticated({ user: USER, accessToken: 'access-token-1' });
    let outcome: boolean | undefined;
    refresher.refreshSession().subscribe((refreshed) => {
      outcome = refreshed;
    });

    http.expectNone('https://localhost:7119/auth/refresh');
    expect(outcome).toBe(false);
    expect(auth.isAnonymous()).toBe(true);
  });

  it('treats a dataless success envelope as failure', () => {
    seedSession(auth, storage);
    let outcome: boolean | undefined;
    refresher.refreshSession().subscribe((refreshed) => {
      outcome = refreshed;
    });

    http.expectOne('https://localhost:7119/auth/refresh').flush({ isSuccess: true, data: null });

    expect(outcome).toBe(false);
    expect(storage.loadSession()).toBeNull();
    expect(auth.isAnonymous()).toBe(true);
  });

  it('establishes the session from storage when unauthenticated', () => {
    storage.saveSession({
      refreshToken: 'refresh-token-1',
      user: USER,
      authenticatedAtUtc: '2026-09-06T12:00:00.000Z',
    });
    expect(auth.isInitializing()).toBe(true);
    let outcome: boolean | undefined;
    refresher.refreshSession().subscribe((refreshed) => {
      outcome = refreshed;
    });

    http.expectOne('https://localhost:7119/auth/refresh').flush({
      isSuccess: true,
      data: ROTATED_PAIR,
    });

    expect(outcome).toBe(true);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.currentUser()).toEqual(USER);
    expect(auth.readAccessToken()).toBe('access-token-2');
    expect(storage.loadSession()?.refreshToken).toBe('refresh-token-2');
  });

  it('never resurrects a session torn down mid-flight', () => {
    seedSession(auth, storage);
    let outcome: boolean | undefined;
    refresher.refreshSession().subscribe((refreshed) => {
      outcome = refreshed;
    });

    auth.clearSession();
    storage.clearSession();
    http.expectOne('https://localhost:7119/auth/refresh').flush({
      isSuccess: true,
      data: ROTATED_PAIR,
    });

    expect(outcome).toBe(false);
    expect(auth.isAnonymous()).toBe(true);
    expect(storage.loadSession()).toBeNull();
  });
});

describe('isRefreshRequest', () => {
  it('identifies the refresh endpoint by path suffix', () => {
    expect(isRefreshRequest('https://localhost:7119/auth/refresh')).toBe(true);
    expect(isRefreshRequest('/auth/refresh')).toBe(true);
    expect(isRefreshRequest('https://localhost:7119/auth/login')).toBe(false);
    expect(isRefreshRequest('https://localhost:7119/auth/me')).toBe(false);
    expect(isRefreshRequest('https://localhost:7119/auth/refreshed')).toBe(false);
  });
});
