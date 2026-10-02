/**
 * Unit tests for Sub-Phases 2.2/2.5/2.8 (state, selectors, transitions) and
 * Sub-Phase 2.9 (logout workflow).
 *
 * `AuthService` carries injected collaborators (`IdentityApiService`,
 * `TokenStorageService`, `Router`), so every test builds it through
 * `TestBed`; the router is a recording stub because only destinations
 * matter here. HTTP runs through `HttpTestingController` for the logout
 * revocation call only.
 */

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideApi, provideAppEnvironment } from '@flux/api';
import { AuthService } from './auth.service';
import type { CurrentUser } from './auth-session';
import { TokenStorageService } from '../session/token-storage';

const USER: CurrentUser = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'ada@flux.local',
  displayName: 'Ada Lovelace',
  roles: ['Customer'],
  permissions: [],
  isEmailVerified: true,
};

const ADMIN: CurrentUser = {
  ...USER,
  id: '22222222-2222-2222-2222-222222222222',
  roles: ['Admin'],
};

const AUTHENTICATED_AT = '2026-09-06T12:00:00.000Z';
const LOGOUT_URL = 'https://localhost:7119/auth/logout';

let navigations: string[];

function configureAuthTesting(): void {
  navigations = [];
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
      {
        provide: Router,
        useValue: {
          navigateByUrl: (url: string): Promise<boolean> => {
            navigations.push(url);
            return Promise.resolve(true);
          },
        },
      },
    ],
  });
  window.localStorage.clear();
}

beforeEach(() => {
  configureAuthTesting();
});

afterEach(() => {
  TestBed.inject(HttpTestingController).verify();
});

function service(): AuthService {
  return TestBed.inject(AuthService);
}

/**
 * Fresh instance for tests asserting on two independent lifecycles:
 * TestBed services are singletons per configured module.
 */
function freshService(): AuthService {
  TestBed.resetTestingModule();
  configureAuthTesting();
  return TestBed.inject(AuthService);
}

function authenticatedService(): AuthService {
  const instance = service();
  instance.setAuthenticated({ user: USER, accessToken: 'access-1' });
  return instance;
}

function seedStoredSession(): void {
  TestBed.inject(TokenStorageService).saveSession({
    refreshToken: 'refresh-token-1',
    user: USER,
    authenticatedAtUtc: AUTHENTICATED_AT,
  });
}

describe('AuthService initial state', () => {
  it('starts initializing with no user, session, or token', () => {
    const instance = service();

    expect(instance.status()).toBe('initializing');
    expect(instance.isInitializing()).toBe(true);
    expect(instance.isAuthenticated()).toBe(false);
    expect(instance.isAnonymous()).toBe(false);
    expect(instance.currentUser()).toBeNull();
    expect(instance.session()).toBeNull();
    expect(instance.roles()).toEqual([]);
    expect(instance.permissions()).toEqual([]);
    expect(instance.hasAccessToken()).toBe(false);
    expect(instance.readAccessToken()).toBeNull();
    expect(instance.isAdmin()).toBe(false);
    expect(instance.isSuperAdmin()).toBe(false);
  });
});

describe('AuthService initialization', () => {
  it('settles initializing to anonymous via markInitializedAnonymous', () => {
    const instance = service();
    instance.markInitializedAnonymous();

    expect(instance.status()).toBe('anonymous');
    expect(instance.isInitializing()).toBe(false);
    expect(instance.isAnonymous()).toBe(true);
    expect(instance.currentUser()).toBeNull();
  });

  it('ignores markInitializedAnonymous once settled', () => {
    const instance = authenticatedService();
    instance.markInitializedAnonymous();

    expect(instance.status()).toBe('authenticated');
    expect(instance.currentUser()).toEqual(USER);
  });

  it('exposes initialized once restoration settles either way', () => {
    const initializing = service();
    expect(initializing.initialized()).toBe(false);

    initializing.markInitializedAnonymous();
    expect(initializing.initialized()).toBe(true);

    expect(authenticatedService().initialized()).toBe(true);
  });
});

describe('AuthService setAuthenticated', () => {
  it('transitions initializing to authenticated with user, session, and token', () => {
    const instance = service();
    instance.setAuthenticated({
      user: USER,
      accessToken: 'access-1',
      authenticatedAtUtc: '2026-09-06T12:00:00.000Z',
    });

    expect(instance.status()).toBe('authenticated');
    expect(instance.isInitializing()).toBe(false);
    expect(instance.isAuthenticated()).toBe(true);
    expect(instance.isAnonymous()).toBe(false);
    expect(instance.currentUser()).toEqual(USER);
    expect(instance.session()).toEqual({
      userId: USER.id,
      hasAccessToken: true,
      authenticatedAtUtc: '2026-09-06T12:00:00.000Z',
    });
    expect(instance.hasAccessToken()).toBe(true);
    expect(instance.readAccessToken()).toBe('access-1');
  });

  it('transitions anonymous to authenticated (login path)', () => {
    const instance = service();
    instance.markInitializedAnonymous();
    instance.setAuthenticated({ user: USER, accessToken: 'access-1' });

    expect(instance.status()).toBe('authenticated');
    expect(instance.currentUser()?.email).toBe('ada@flux.local');
  });

  it('ignores setAuthenticated while already authenticated', () => {
    const instance = authenticatedService();
    instance.setAuthenticated({ user: ADMIN, accessToken: 'access-2' });

    expect(instance.currentUser()).toEqual(USER);
    expect(instance.readAccessToken()).toBe('access-1');
  });
});

describe('AuthService replaceAccessToken', () => {
  it('replaces the token while authenticated without disturbing user or status', () => {
    const instance = authenticatedService();
    instance.replaceAccessToken('access-2');

    expect(instance.status()).toBe('authenticated');
    expect(instance.readAccessToken()).toBe('access-2');
    expect(instance.hasAccessToken()).toBe(true);
    expect(instance.currentUser()).toEqual(USER);
    expect(instance.session()?.hasAccessToken).toBe(true);
  });

  it('ignores replacement while anonymous or initializing', () => {
    const anonymous = service();
    anonymous.markInitializedAnonymous();
    anonymous.replaceAccessToken('access-x');
    expect(anonymous.readAccessToken()).toBeNull();
    expect(anonymous.status()).toBe('anonymous');

    const initializing = freshService();
    initializing.replaceAccessToken('access-x');
    expect(initializing.readAccessToken()).toBeNull();
    expect(initializing.status()).toBe('initializing');
  });
});

describe('AuthService updateCurrentUser', () => {
  it('replaces the user snapshot while authenticated without touching token or status', () => {
    const instance = authenticatedService();
    const hydrated: CurrentUser = { ...USER, displayName: 'Ada L.' };
    instance.updateCurrentUser(hydrated);

    expect(instance.status()).toBe('authenticated');
    expect(instance.currentUser()).toEqual(hydrated);
    expect(instance.session()?.userId).toBe(USER.id);
    expect(instance.readAccessToken()).toBe('access-1');
    expect(instance.roles()).toEqual(['Customer']);
  });

  it('ignores updates while anonymous or initializing', () => {
    const anonymous = service();
    anonymous.markInitializedAnonymous();
    anonymous.updateCurrentUser(ADMIN);
    expect(anonymous.currentUser()).toBeNull();

    const initializing = freshService();
    initializing.updateCurrentUser(ADMIN);
    expect(initializing.currentUser()).toBeNull();
    expect(initializing.status()).toBe('initializing');
  });
});

describe('AuthService clearSession', () => {
  it('tears down an authenticated session to anonymous', () => {
    const instance = authenticatedService();
    instance.clearSession();

    expect(instance.status()).toBe('anonymous');
    expect(instance.isAnonymous()).toBe(true);
    expect(instance.isAuthenticated()).toBe(false);
    expect(instance.currentUser()).toBeNull();
    expect(instance.session()).toBeNull();
    expect(instance.readAccessToken()).toBeNull();
    expect(instance.hasAccessToken()).toBe(false);
    expect(instance.roles()).toEqual([]);
  });

  it('is idempotent while anonymous', () => {
    const instance = service();
    instance.markInitializedAnonymous();
    instance.clearSession();

    expect(instance.status()).toBe('anonymous');
  });

  it('never settles initializing (restoration owns that decision)', () => {
    const instance = service();
    instance.clearSession();

    expect(instance.status()).toBe('initializing');
    expect(instance.isInitializing()).toBe(true);
  });
});

describe('AuthService role selectors', () => {
  it('exposes roles and reacts to session changes', () => {
    const instance = service();
    expect(instance.hasRole('Customer')()).toBe(false);

    instance.setAuthenticated({ user: USER, accessToken: 'access-1' });
    expect(instance.roles()).toEqual(['Customer']);
    expect(instance.hasRole('Customer')()).toBe(true);
    expect(instance.hasRole('Admin')()).toBe(false);

    instance.clearSession();
    expect(instance.hasRole('Customer')()).toBe(false);
  });

  it('flags admins strictly by the Admin role claim', () => {
    const instance = service();
    instance.setAuthenticated({ user: ADMIN, accessToken: 'access-1' });
    expect(instance.isAdmin()).toBe(true);

    const superAdmin = freshService();
    superAdmin.setAuthenticated({
      user: { ...USER, roles: ['SuperAdmin'] },
      accessToken: 'access-1',
    });
    expect(superAdmin.hasRole('SuperAdmin')()).toBe(true);
    expect(superAdmin.isAdmin()).toBe(false);
  });
});

describe('AuthService permission selectors (Supplement S1)', () => {
  it('exposes empty permissions until the first me hydration', () => {
    const instance = service();
    expect(instance.permissions()).toEqual([]);
    expect(instance.hasPermission('orders.read')()).toBe(false);
    expect(instance.isSuperAdmin()).toBe(false);
  });

  it('mirrors me permissions verbatim without implication', () => {
    const instance = service();
    instance.setAuthenticated({
      user: { ...ADMIN, permissions: ['orders.read', 'dashboard.read'] },
      accessToken: 'access-1',
    });

    expect(instance.permissions()).toEqual(['orders.read', 'dashboard.read']);
    expect(instance.hasPermission('orders.read')()).toBe(true);
    expect(instance.hasPermission('catalog.manage')()).toBe(false);
    // SuperAdmin holds no permissions: the bypass lives in the guard.
    expect(instance.isSuperAdmin()).toBe(false);
  });

  it('flags SuperAdmin strictly by the SuperAdmin role claim', () => {
    const instance = service();
    instance.setAuthenticated({
      user: { ...USER, roles: ['SuperAdmin'], permissions: [] },
      accessToken: 'access-1',
    });

    expect(instance.isSuperAdmin()).toBe(true);
    expect(instance.hasPermission('orders.read')()).toBe(false);
  });

  it('drops permissions on a me re-sync that omits them (demotion rule)', () => {
    const instance = service();
    instance.setAuthenticated({
      user: { ...ADMIN, permissions: ['orders.read'] },
      accessToken: 'access-1',
    });
    expect(instance.hasPermission('orders.read')()).toBe(true);

    instance.updateCurrentUser({ ...ADMIN, permissions: [] });

    expect(instance.permissions()).toEqual([]);
    expect(instance.hasPermission('orders.read')()).toBe(false);
  });

  it('clears permissions with the session', () => {
    const instance = service();
    instance.setAuthenticated({
      user: { ...ADMIN, permissions: ['orders.read'] },
      accessToken: 'access-1',
    });
    instance.clearSession();

    expect(instance.permissions()).toEqual([]);
    expect(instance.hasPermission('orders.read')()).toBe(false);
    expect(instance.isSuperAdmin()).toBe(false);
  });
});

describe('AuthService logout', () => {
  it('revokes server-side, clears everything, and redirects home', () => {
    const instance = authenticatedService();
    seedStoredSession();
    const http = TestBed.inject(HttpTestingController);
    let completed = false;
    instance.logout().subscribe({ complete: () => (completed = true) });

    const request = http.expectOne(LOGOUT_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ refreshToken: 'refresh-token-1' });
    request.flush({ isSuccess: true });

    expect(completed).toBe(true);
    expect(instance.isAnonymous()).toBe(true);
    expect(instance.currentUser()).toBeNull();
    expect(instance.session()).toBeNull();
    expect(instance.readAccessToken()).toBeNull();
    expect(instance.roles()).toEqual([]);
    expect(TestBed.inject(TokenStorageService).loadSession()).toBeNull();
    expect(navigations).toEqual(['/']);
  });

  it('clears and redirects even when backend logout fails', () => {
    const instance = authenticatedService();
    seedStoredSession();
    const http = TestBed.inject(HttpTestingController);
    let completed = false;
    let failed = false;
    instance.logout().subscribe({
      complete: () => (completed = true),
      error: () => (failed = true),
    });

    http.expectOne(LOGOUT_URL).flush(
      {
        type: 'https://tools.ietf.org/html/rfc7231#section-6.6.1',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Something failed.',
        extensions: {},
      },
      { status: 500, statusText: 'Server Error' },
    );

    expect(failed).toBe(false);
    expect(completed).toBe(true);
    expect(instance.isAnonymous()).toBe(true);
    expect(instance.currentUser()).toBeNull();
    expect(instance.readAccessToken()).toBeNull();
    expect(TestBed.inject(TokenStorageService).loadSession()).toBeNull();
    expect(navigations).toEqual(['/']);
  });

  it('clears and redirects without HTTP when no token is stored', () => {
    const instance = authenticatedService();
    const http = TestBed.inject(HttpTestingController);
    let completed = false;
    instance.logout().subscribe({ complete: () => (completed = true) });

    http.expectNone(LOGOUT_URL);
    expect(completed).toBe(true);
    expect(instance.isAnonymous()).toBe(true);
    expect(navigations).toEqual(['/']);
  });

  it('honors same-origin redirects and blocks open redirects', () => {
    const instance = authenticatedService();
    instance.logout({ redirectTo: '/login' }).subscribe();
    instance.logout({ redirectTo: 'https://evil.example/phish' }).subscribe();

    expect(navigations).toEqual(['/login', '/']);
  });

  it('stays safe when called while anonymous', () => {
    const instance = service();
    instance.markInitializedAnonymous();
    const http = TestBed.inject(HttpTestingController);
    let completed = false;
    instance.logout().subscribe({ complete: () => (completed = true) });

    http.expectNone(LOGOUT_URL);
    expect(completed).toBe(true);
    expect(instance.isAnonymous()).toBe(true);
    expect(navigations).toEqual(['/']);
  });
});
