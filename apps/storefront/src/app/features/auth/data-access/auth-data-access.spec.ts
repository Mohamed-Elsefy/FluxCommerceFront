/**
 * Orchestration tests for Sub-Phases 2.4/2.5 — login and registration workflows.
 *
 * `IdentityApiService` (the shared-lib HTTP boundary, already covered by
 * `libs/api` specs) is stubbed at its typed seam so these tests own the
 * feature logic: provisional session establishment, central profile
 * hydration (no headers attached here — Sub-Phase 2.5), rollback on
 * hydration failure, and the no-auto-login registration rule. The stub
 * records the `GET /auth/me` options to prove no token headers are managed
 * by the feature.
 */

import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiError, IdentityApiService, type ApiRequestOptions } from '@flux/api';
import { AuthService, TokenStorageService } from '@flux/auth';
import type { LoginResponse, UserResponse } from '@flux/models';
import {
  AuthDataAccess,
  mapLoginResponseToProvisionalUser,
  mapUserResponseToCurrentUser,
} from './auth-data-access';

const ME_FIXTURE: UserResponse = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'ada@flux.local',
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

const LOGIN_FIXTURE: LoginResponse = {
  userId: ME_FIXTURE.id,
  email: ME_FIXTURE.email,
  roles: ['Customer'],
  accessToken: 'access-token-1',
  refreshToken: 'refresh-token-1',
  refreshTokenExpiresAtUtc: '2026-09-13T12:00:00Z',
};

interface IdentityCalls {
  loginBodies: unknown[];
  meOptions: ApiRequestOptions[];
  registerBodies: unknown[];
}

function setup(flows: {
  login?: () => ReturnType<IdentityApiService['login']>;
  me?: () => ReturnType<IdentityApiService['getCurrentUser']>;
  register?: () => ReturnType<IdentityApiService['register']>;
}): {
  dataAccess: AuthDataAccess;
  auth: AuthService;
  storage: TokenStorageService;
  calls: IdentityCalls;
} {
  const calls: IdentityCalls = { loginBodies: [], meOptions: [], registerBodies: [] };
  const identityStub: IdentityApiService = {
    login: ((body: unknown) => {
      calls.loginBodies.push(body);
      return flows.login?.() ?? of({ isSuccess: true, data: LOGIN_FIXTURE });
    }) as IdentityApiService['login'],
    getCurrentUser: ((options: ApiRequestOptions = {}) => {
      calls.meOptions.push(options);
      return flows.me?.() ?? of({ isSuccess: true, data: ME_FIXTURE });
    }) as IdentityApiService['getCurrentUser'],
    register: ((body: unknown) => {
      calls.registerBodies.push(body);
      return (
        flows.register?.() ??
        of({ isSuccess: true, data: { ...ME_FIXTURE, isEmailVerified: false } })
      );
    }) as IdentityApiService['register'],
  } as IdentityApiService;

  TestBed.configureTestingModule({
    providers: [{ provide: IdentityApiService, useValue: identityStub }],
  });
  window.localStorage.clear();
  return {
    dataAccess: TestBed.inject(AuthDataAccess),
    auth: TestBed.inject(AuthService),
    storage: TestBed.inject(TokenStorageService),
    calls,
  };
}

describe('AuthDataAccess login', () => {
  it('stores the session, loads the user, and authenticates', () => {
    const { dataAccess, auth, storage, calls } = setup({});
    let userId: string | undefined;
    dataAccess.login({ email: 'ada@flux.local', password: 'Valid123!' }).subscribe((user) => {
      userId = user.id;
    });

    expect(calls.loginBodies).toEqual([{ email: 'ada@flux.local', password: 'Valid123!' }]);
    expect(calls.meOptions).toEqual([{}]);
    expect(userId).toBe(ME_FIXTURE.id);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.currentUser()?.email).toBe('ada@flux.local');
    expect(auth.currentUser()?.displayName).toBe('Ada Lovelace');
    expect(auth.readAccessToken()).toBe('access-token-1');
    expect(storage.loadSession()?.refreshToken).toBe('refresh-token-1');
    expect(storage.loadSession()?.user.displayName).toBe('Ada Lovelace');
  });

  it('rolls the provisional session back when hydration fails', () => {
    const rejection = new ApiError({ status: 401, message: 'Unauthorized.' });
    const { dataAccess, auth, storage } = setup({ me: () => throwError(() => rejection) });
    let observed: unknown;
    dataAccess.login({ email: 'ada@flux.local', password: 'Valid123!' }).subscribe({
      error: (error: unknown) => {
        observed = error;
      },
    });

    expect(observed).toBe(rejection);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.currentUser()).toBeNull();
    expect(auth.readAccessToken()).toBeNull();
    expect(storage.loadSession()).toBeNull();
  });

  it('leaves state untouched when credentials are rejected', () => {
    const rejection = new ApiError({ status: 401, message: 'Invalid email or password.' });
    const { dataAccess, auth, storage } = setup({ login: () => throwError(() => rejection) });
    let observed: unknown;
    dataAccess.login({ email: 'ada@flux.local', password: 'Wrong123!' }).subscribe({
      error: (error: unknown) => {
        observed = error;
      },
    });

    expect(observed).toBe(rejection);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.isAnonymous() || auth.isInitializing()).toBe(true);
    expect(storage.loadSession()).toBeNull();
  });

  it('fails loudly on dataless success envelopes', () => {
    const { dataAccess, auth } = setup({ me: () => of({ isSuccess: true, data: null }) });
    let observed: unknown;
    dataAccess.login({ email: 'ada@flux.local', password: 'Valid123!' }).subscribe({
      error: (error: unknown) => {
        observed = error;
      },
    });

    expect(observed).toBeInstanceOf(ApiError);
    expect(auth.isAuthenticated()).toBe(false);
  });
});

describe('AuthDataAccess register', () => {
  it('returns a pending-verification result without authenticating', () => {
    const { dataAccess, auth, storage, calls } = setup({});
    let result: { email: string; isEmailVerified: boolean } | undefined;
    dataAccess
      .register({
        email: 'ada@flux.local',
        password: 'Valid123!',
        firstName: 'Ada',
        lastName: 'Lovelace',
      })
      .subscribe((outcome) => {
        result = outcome;
      });

    expect(calls.registerBodies).toHaveLength(1);
    expect(result?.email).toBe('ada@flux.local');
    expect(result?.isEmailVerified).toBe(false);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.currentUser()).toBeNull();
    expect(auth.readAccessToken()).toBeNull();
    expect(storage.loadSession()).toBeNull();
  });

  it('surfaces duplicate-email conflicts as ApiError', () => {
    const rejection = new ApiError({
      status: 409,
      message: 'An account with this email already exists.',
    });
    const { dataAccess, auth } = setup({ register: () => throwError(() => rejection) });
    let observed: unknown;
    dataAccess
      .register({
        email: 'ada@flux.local',
        password: 'Valid123!',
        firstName: 'Ada',
        lastName: 'Lovelace',
      })
      .subscribe({
        error: (error: unknown) => {
          observed = error;
        },
      });

    expect(observed).toBe(rejection);
    expect(auth.isAuthenticated()).toBe(false);
  });
});

describe('mapLoginResponseToProvisionalUser', () => {
  it('derives a verified user with a pending display name', () => {
    expect(mapLoginResponseToProvisionalUser(LOGIN_FIXTURE)).toEqual({
      id: LOGIN_FIXTURE.userId,
      email: LOGIN_FIXTURE.email,
      displayName: null,
      roles: ['Customer'],
      isEmailVerified: true,
    });
  });
});

describe('mapUserResponseToCurrentUser', () => {
  it('falls back to first/last name when displayName is null', () => {
    expect(mapUserResponseToCurrentUser({ ...ME_FIXTURE, displayName: null }).displayName).toBe(
      'Ada Lovelace',
    );
    expect(mapUserResponseToCurrentUser(ME_FIXTURE).displayName).toBe('Ada Lovelace');
  });
});
