import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiError, IdentityApiService, type ApiRequestOptions } from '@flux/api';
import { AuthService, TokenStorageService } from '@flux/auth';
import type { LoginResponse, UserResponse } from '@flux/models';
import { AdminAuthDataAccess, mapLoginResponseToProvisionalUser } from './admin-auth-data-access';

const ME_FIXTURE: UserResponse = {
  id: '22222222-2222-2222-2222-222222222222',
  email: 'boss@flux.local',
  roles: ['Admin'],
  isEmailVerified: true,
  registeredAtUtc: '2026-09-06T12:00:00Z',
  firstName: 'Boss',
  lastName: 'Admin',
  displayName: 'Boss Admin',
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
  roles: ['Admin'],
  accessToken: 'admin-access-1',
  refreshToken: 'admin-refresh-1',
  refreshTokenExpiresAtUtc: '2026-09-13T12:00:00Z',
};

function setup(flows: {
  login?: () => ReturnType<IdentityApiService['login']>;
  me?: () => ReturnType<IdentityApiService['getCurrentUser']>;
}): {
  dataAccess: AdminAuthDataAccess;
  auth: AuthService;
  storage: TokenStorageService;
  loginBodies: unknown[];
  meOptions: ApiRequestOptions[];
} {
  const loginBodies: unknown[] = [];
  const meOptions: ApiRequestOptions[] = [];
  const identityStub: IdentityApiService = {
    login: ((body: unknown) => {
      loginBodies.push(body);
      return flows.login?.() ?? of({ isSuccess: true, data: LOGIN_FIXTURE });
    }) as IdentityApiService['login'],
    getCurrentUser: ((options: ApiRequestOptions = {}) => {
      meOptions.push(options);
      return flows.me?.() ?? of({ isSuccess: true, data: ME_FIXTURE });
    }) as IdentityApiService['getCurrentUser'],
  } as IdentityApiService;

  TestBed.configureTestingModule({
    providers: [
      AdminAuthDataAccess,
      { provide: IdentityApiService, useValue: identityStub },
      { provide: Router, useValue: { navigateByUrl: () => Promise.resolve(true) } },
    ],
  });

  return {
    dataAccess: TestBed.inject(AdminAuthDataAccess),
    auth: TestBed.inject(AuthService),
    storage: TestBed.inject(TokenStorageService),
    loginBodies,
    meOptions,
  };
}

describe('AdminAuthDataAccess', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    window.localStorage.clear();
  });

  it('maps the provisional user without implying admin authorization', () => {
    const provisional = mapLoginResponseToProvisionalUser(LOGIN_FIXTURE);

    expect(provisional.id).toBe(LOGIN_FIXTURE.userId);
    expect(provisional.email).toBe(LOGIN_FIXTURE.email);
    expect(provisional.roles).toEqual(['Admin']);
    expect(provisional.displayName).toBeNull();
  });

  it('establishes the session then hydrates the profile', () => {
    const { dataAccess, auth, loginBodies, meOptions } = setup({});

    let result: unknown;
    dataAccess
      .login({ email: 'boss@flux.local', password: 'Secret123!' })
      .subscribe((user) => (result = user));

    expect(loginBodies).toEqual([{ email: 'boss@flux.local', password: 'Secret123!' }]);
    expect(meOptions).toHaveLength(1);
    expect(meOptions[0]).toEqual({});
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.currentUser()?.displayName).toBe('Boss Admin');
    expect(result).toEqual(auth.currentUser());
  });

  it('rolls back the session when profile hydration fails', () => {
    const failure = new ApiError({ status: 401, code: 'Identity.InvalidToken', message: 'no' });
    const { dataAccess, auth, storage } = setup({ me: () => throwError(() => failure) });

    let observed: unknown;
    dataAccess.login({ email: 'boss@flux.local', password: 'Secret123!' }).subscribe({
      error: (error: unknown) => (observed = error),
    });

    expect(observed).toBe(failure);
    expect(auth.isAuthenticated()).toBe(false);
    expect(storage.loadSession()).toBeNull();
  });
});
