/**
 * Unit tests for Sub-Phase 2.2 — Authentication State & Session Foundation.
 *
 * Scope: `AuthService` transition rules and signal selectors only. No HTTP,
 * no storage, no interceptors — the service is instantiated directly because
 * it has no dependencies.
 */

import { describe, expect, it } from 'vitest';
import { AuthService } from './auth.service';
import type { CurrentUser } from './auth-session';

const USER: CurrentUser = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'ada@flux.local',
  displayName: 'Ada Lovelace',
  roles: ['Customer'],
  isEmailVerified: true,
};

const ADMIN: CurrentUser = {
  ...USER,
  id: '22222222-2222-2222-2222-222222222222',
  roles: ['Admin'],
};

function authenticatedService(): AuthService {
  const service = new AuthService();
  service.setAuthenticated({ user: USER, accessToken: 'access-1' });
  return service;
}

describe('AuthService initial state', () => {
  it('starts initializing with no user, session, or token', () => {
    const service = new AuthService();

    expect(service.status()).toBe('initializing');
    expect(service.isInitializing()).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.isAnonymous()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(service.session()).toBeNull();
    expect(service.roles()).toEqual([]);
    expect(service.hasAccessToken()).toBe(false);
    expect(service.readAccessToken()).toBeNull();
    expect(service.isAdmin()).toBe(false);
  });
});

describe('AuthService initialization', () => {
  it('settles initializing to anonymous via markInitializedAnonymous', () => {
    const service = new AuthService();
    service.markInitializedAnonymous();

    expect(service.status()).toBe('anonymous');
    expect(service.isInitializing()).toBe(false);
    expect(service.isAnonymous()).toBe(true);
    expect(service.currentUser()).toBeNull();
  });

  it('ignores markInitializedAnonymous once settled', () => {
    const service = authenticatedService();
    service.markInitializedAnonymous();

    expect(service.status()).toBe('authenticated');
    expect(service.currentUser()).toEqual(USER);
  });

  it('exposes initialized once restoration settles either way', () => {
    const initializing = new AuthService();
    expect(initializing.initialized()).toBe(false);

    initializing.markInitializedAnonymous();
    expect(initializing.initialized()).toBe(true);

    expect(authenticatedService().initialized()).toBe(true);
  });
});

describe('AuthService setAuthenticated', () => {
  it('transitions initializing to authenticated with user, session, and token', () => {
    const service = new AuthService();
    service.setAuthenticated({
      user: USER,
      accessToken: 'access-1',
      authenticatedAtUtc: '2026-09-06T12:00:00.000Z',
    });

    expect(service.status()).toBe('authenticated');
    expect(service.isInitializing()).toBe(false);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.isAnonymous()).toBe(false);
    expect(service.currentUser()).toEqual(USER);
    expect(service.session()).toEqual({
      userId: USER.id,
      hasAccessToken: true,
      authenticatedAtUtc: '2026-09-06T12:00:00.000Z',
    });
    expect(service.hasAccessToken()).toBe(true);
    expect(service.readAccessToken()).toBe('access-1');
  });

  it('transitions anonymous to authenticated (login path)', () => {
    const service = new AuthService();
    service.markInitializedAnonymous();
    service.setAuthenticated({ user: USER, accessToken: 'access-1' });

    expect(service.status()).toBe('authenticated');
    expect(service.currentUser()?.email).toBe('ada@flux.local');
  });

  it('ignores setAuthenticated while already authenticated', () => {
    const service = authenticatedService();
    service.setAuthenticated({ user: ADMIN, accessToken: 'access-2' });

    expect(service.currentUser()).toEqual(USER);
    expect(service.readAccessToken()).toBe('access-1');
  });
});

describe('AuthService replaceAccessToken', () => {
  it('replaces the token while authenticated without disturbing user or status', () => {
    const service = authenticatedService();
    service.replaceAccessToken('access-2');

    expect(service.status()).toBe('authenticated');
    expect(service.readAccessToken()).toBe('access-2');
    expect(service.hasAccessToken()).toBe(true);
    expect(service.currentUser()).toEqual(USER);
    expect(service.session()?.hasAccessToken).toBe(true);
  });

  it('ignores replacement while anonymous or initializing', () => {
    const anonymous = new AuthService();
    anonymous.markInitializedAnonymous();
    anonymous.replaceAccessToken('access-x');
    expect(anonymous.readAccessToken()).toBeNull();
    expect(anonymous.status()).toBe('anonymous');

    const initializing = new AuthService();
    initializing.replaceAccessToken('access-x');
    expect(initializing.readAccessToken()).toBeNull();
    expect(initializing.status()).toBe('initializing');
  });
});

describe('AuthService updateCurrentUser', () => {
  it('replaces the user snapshot while authenticated without touching token or status', () => {
    const service = authenticatedService();
    const hydrated: CurrentUser = { ...USER, displayName: 'Ada L.' };
    service.updateCurrentUser(hydrated);

    expect(service.status()).toBe('authenticated');
    expect(service.currentUser()).toEqual(hydrated);
    expect(service.session()?.userId).toBe(USER.id);
    expect(service.readAccessToken()).toBe('access-1');
    expect(service.roles()).toEqual(['Customer']);
  });

  it('ignores updates while anonymous or initializing', () => {
    const anonymous = new AuthService();
    anonymous.markInitializedAnonymous();
    anonymous.updateCurrentUser(ADMIN);
    expect(anonymous.currentUser()).toBeNull();

    const initializing = new AuthService();
    initializing.updateCurrentUser(ADMIN);
    expect(initializing.currentUser()).toBeNull();
    expect(initializing.status()).toBe('initializing');
  });
});

describe('AuthService clearSession', () => {
  it('tears down an authenticated session to anonymous', () => {
    const service = authenticatedService();
    service.clearSession();

    expect(service.status()).toBe('anonymous');
    expect(service.isAnonymous()).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(service.session()).toBeNull();
    expect(service.readAccessToken()).toBeNull();
    expect(service.hasAccessToken()).toBe(false);
    expect(service.roles()).toEqual([]);
  });

  it('is idempotent while anonymous', () => {
    const service = new AuthService();
    service.markInitializedAnonymous();
    service.clearSession();

    expect(service.status()).toBe('anonymous');
  });

  it('never settles initializing (restoration owns that decision)', () => {
    const service = new AuthService();
    service.clearSession();

    expect(service.status()).toBe('initializing');
    expect(service.isInitializing()).toBe(true);
  });
});

describe('AuthService role selectors', () => {
  it('exposes roles and reacts to session changes', () => {
    const service = new AuthService();
    expect(service.hasRole('Customer')()).toBe(false);

    service.setAuthenticated({ user: USER, accessToken: 'access-1' });
    expect(service.roles()).toEqual(['Customer']);
    expect(service.hasRole('Customer')()).toBe(true);
    expect(service.hasRole('Admin')()).toBe(false);

    service.clearSession();
    expect(service.hasRole('Customer')()).toBe(false);
  });

  it('flags admins strictly by the Admin role claim', () => {
    const service = new AuthService();
    service.setAuthenticated({ user: ADMIN, accessToken: 'access-1' });
    expect(service.isAdmin()).toBe(true);

    const superAdmin = new AuthService();
    superAdmin.setAuthenticated({
      user: { ...USER, roles: ['SuperAdmin'] },
      accessToken: 'access-1',
    });
    expect(superAdmin.hasRole('SuperAdmin')()).toBe(true);
    expect(superAdmin.isAdmin()).toBe(false);
  });
});
