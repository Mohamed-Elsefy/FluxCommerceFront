/**
 * Session restoration tests for Sub-Phase 2.8.
 *
 * The real `libs/api` chain runs against `HttpTestingController` (no live
 * backend) to prove the startup workflow: fast anonymous settling without
 * HTTP, refresh-then-hydrate restoration with centrally injected Bearer
 * headers, teardown on invalid sessions, resilience on transient profile
 * failures, SSR safety, idempotent startup, and initializer registration.
 */

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID, type EnvironmentProviders, type Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideApi, provideAppEnvironment } from '@flux/api';
import {
  AUTH_SESSION_STORAGE_KEY,
  AuthService,
  TokenStorageService,
  provideAccessToken,
  type CurrentUser,
} from '@flux/auth';
import type { UserResponse } from '@flux/models';
import { SessionRestoreService, provideSessionRestore } from './session-restore.service';

const STORED_USER: CurrentUser = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'ada@flux.local',
  displayName: null,
  roles: ['Customer'],
  isEmailVerified: true,
};

const AUTHENTICATED_AT = '2026-09-06T12:00:00.000Z';

const ROTATED_PAIR = {
  userId: STORED_USER.id,
  email: STORED_USER.email,
  roles: ['Customer'],
  accessToken: 'access-token-2',
  refreshToken: 'refresh-token-2',
  refreshTokenExpiresAtUtc: '2026-09-13T12:00:00Z',
};

const ME_FIXTURE: UserResponse = {
  id: STORED_USER.id,
  email: STORED_USER.email,
  roles: ['Customer'],
  isEmailVerified: true,
  registeredAtUtc: '2026-09-06T12:00:00Z',
  firstName: 'Ada',
  lastName: 'Lovelace',
  displayName: 'Ada Lovelace',
  phoneNumber: null,
  isPhoneVerified: false,
  avatarUrl: null,
  preferredLanguage: 'en',
  timeZone: 'UTC',
  status: 1,
};

const REFRESH_URL = 'https://localhost:7119/auth/refresh';
const ME_URL = 'https://localhost:7119/auth/me';

function configureModule(options: { platform?: string; initializer?: boolean } = {}): void {
  const providers: (Provider | EnvironmentProviders)[] = [
    provideAppEnvironment({
      name: 'development',
      production: false,
      appName: 'test',
      apiBaseUrl: 'https://localhost:7119',
    }),
    provideApi(),
    provideAccessToken(),
    provideHttpClientTesting(),
  ];
  if (options.initializer === true) {
    providers.push(provideSessionRestore());
  }
  if (options.platform !== undefined) {
    providers.push({ provide: PLATFORM_ID, useValue: options.platform });
  }
  TestBed.configureTestingModule({ providers });
  window.localStorage.clear();
}

function setup(platform?: string): {
  restorer: SessionRestoreService;
  auth: AuthService;
  storage: TokenStorageService;
  http: HttpTestingController;
} {
  configureModule({ platform });
  return {
    restorer: TestBed.inject(SessionRestoreService),
    auth: TestBed.inject(AuthService),
    storage: TestBed.inject(TokenStorageService),
    http: TestBed.inject(HttpTestingController),
  };
}

function seedStorage(storage: TokenStorageService): void {
  storage.saveSession({
    refreshToken: 'refresh-token-1',
    user: STORED_USER,
    authenticatedAtUtc: AUTHENTICATED_AT,
  });
}

function unauthorized(): Record<string, unknown> {
  return {
    type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
    title: 'Unauthorized',
    status: 401,
    detail: 'Invalid refresh token.',
    extensions: {},
  };
}

describe('SessionRestoreService', () => {
  let restorer: SessionRestoreService;
  let auth: AuthService;
  let storage: TokenStorageService;
  let http: HttpTestingController;

  beforeEach(() => {
    ({ restorer, auth, storage, http } = setup());
  });

  afterEach(() => {
    http.verify();
  });

  it('settles to anonymous without HTTP when nothing is stored', () => {
    expect(auth.isInitializing()).toBe(true);
    let outcome: boolean | undefined;
    restorer.restoreSession().subscribe((restored) => {
      outcome = restored;
    });

    http.expectNone(REFRESH_URL);
    http.expectNone(ME_URL);
    expect(outcome).toBe(false);
    expect(auth.isAnonymous()).toBe(true);
    expect(auth.initialized()).toBe(true);
  });

  it('restores via refresh then hydrates the current user', () => {
    seedStorage(storage);
    let outcome: boolean | undefined;
    restorer.restoreSession().subscribe((restored) => {
      outcome = restored;
    });

    const refresh = http.expectOne(REFRESH_URL);
    expect(refresh.request.body).toEqual({ refreshToken: 'refresh-token-1' });
    refresh.flush({ isSuccess: true, data: ROTATED_PAIR });

    const me = http.expectOne(ME_URL);
    expect(me.request.headers.get('Authorization')).toBe('Bearer access-token-2');
    me.flush({ isSuccess: true, data: ME_FIXTURE });

    expect(outcome).toBe(true);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.initialized()).toBe(true);
    expect(auth.currentUser()?.displayName).toBe('Ada Lovelace');
    expect(auth.readAccessToken()).toBe('access-token-2');
    expect(storage.loadSession()).toEqual({
      refreshToken: 'refresh-token-2',
      user: { ...STORED_USER, displayName: 'Ada Lovelace' },
      authenticatedAtUtc: AUTHENTICATED_AT,
    });
  });

  it('settles to anonymous when the refresh fails, without calling me', () => {
    seedStorage(storage);
    let outcome: boolean | undefined;
    restorer.restoreSession().subscribe((restored) => {
      outcome = restored;
    });

    http.expectOne(REFRESH_URL).flush(unauthorized(), {
      status: 401,
      statusText: 'Unauthorized',
    });
    http.expectNone(ME_URL);

    expect(outcome).toBe(false);
    expect(auth.isAnonymous()).toBe(true);
    expect(auth.initialized()).toBe(true);
    expect(storage.loadSession()).toBeNull();
  });

  it('tears down when the profile rejects the rotated session', () => {
    seedStorage(storage);
    let outcome: boolean | undefined;
    restorer.restoreSession().subscribe((restored) => {
      outcome = restored;
    });

    http.expectOne(REFRESH_URL).flush({ isSuccess: true, data: ROTATED_PAIR });
    http.expectOne(ME_URL).flush(
      {
        type: 'https://tools.ietf.org/html/rfc7231#section-6.5.4',
        title: 'Not Found',
        status: 404,
        detail: 'User not found.',
        extensions: {},
      },
      { status: 404, statusText: 'Not Found' },
    );

    expect(outcome).toBe(false);
    expect(auth.isAnonymous()).toBe(true);
    expect(storage.loadSession()).toBeNull();
  });

  it('keeps the refreshed session on transient profile failures', () => {
    seedStorage(storage);
    let outcome: boolean | undefined;
    restorer.restoreSession().subscribe((restored) => {
      outcome = restored;
    });

    http.expectOne(REFRESH_URL).flush({ isSuccess: true, data: ROTATED_PAIR });
    http.expectOne(ME_URL).flush(
      {
        type: 'https://tools.ietf.org/html/rfc7231#section-6.6.1',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Something failed.',
        extensions: {},
      },
      { status: 500, statusText: 'Server Error' },
    );

    expect(outcome).toBe(true);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.initialized()).toBe(true);
    expect(auth.currentUser()).toEqual(STORED_USER);
    expect(auth.readAccessToken()).toBe('access-token-2');
  });

  it('starts exactly once', () => {
    seedStorage(storage);
    restorer.start();
    restorer.start();

    http.expectOne(REFRESH_URL).flush({ isSuccess: true, data: ROTATED_PAIR });
    http.expectOne(ME_URL).flush({ isSuccess: true, data: ME_FIXTURE });

    expect(auth.isAuthenticated()).toBe(true);
  });

  it('runs restoration from the startup initializer without manual start', () => {
    // Fresh module WITH the provider: TestBed executes APP_INITIALIZERs on
    // instantiation, so the raw entry must be seeded before first injection.
    TestBed.resetTestingModule();
    configureModule({ initializer: true });
    window.localStorage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({
        refreshToken: 'refresh-token-1',
        user: STORED_USER,
        authenticatedAtUtc: AUTHENTICATED_AT,
      }),
    );
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);

    const refresh = http.expectOne(REFRESH_URL);
    expect(refresh.request.body).toEqual({ refreshToken: 'refresh-token-1' });
    refresh.flush({ isSuccess: true, data: ROTATED_PAIR });
    http.expectOne(ME_URL).flush({ isSuccess: true, data: ME_FIXTURE });

    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.initialized()).toBe(true);
  });
});

describe('SessionRestoreService on the server platform (SSR)', () => {
  it('settles to anonymous without touching HTTP', () => {
    const { restorer, auth, http } = setup('server');
    let outcome: boolean | undefined;
    restorer.restoreSession().subscribe((restored) => {
      outcome = restored;
    });

    http.expectNone(REFRESH_URL);
    http.expectNone(ME_URL);
    expect(outcome).toBe(false);
    expect(auth.isAnonymous()).toBe(true);
    expect(auth.initialized()).toBe(true);
  });
});
