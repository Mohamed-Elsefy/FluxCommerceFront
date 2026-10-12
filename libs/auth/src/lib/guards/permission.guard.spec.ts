/**
 * Permission guard tests for Supplement S1, Step S1.3.
 *
 * Runs in a real `TestBed` injection context against a real `AuthService`;
 * route snapshots are minimal fakes carrying only `data`. Proves the
 * evaluation table: OR-semantics allow, `SuperAdmin` bypass without held
 * permissions, fail-closed configuration, anonymous denial, deferred
 * decisions during initialization, and the demotion rule (a `me` re-sync
 * that drops a permission denies on the next navigation — the UI-layer
 * counterpart of the backend's next-login/refresh semantics).
 */

import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  provideRouter,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { Observable } from 'rxjs';
import { provideApi, provideAppEnvironment } from '@flux/api';
import { AuthService, type CurrentUser } from '@flux/auth';
import { permissionGuard } from './permission.guard';

const ADMIN: CurrentUser = {
  id: '22222222-2222-2222-2222-222222222222',
  email: 'boss@flux.local',
  displayName: 'Boss',
  roles: ['Admin'],
  permissions: ['orders.read', 'dashboard.read'],
  isEmailVerified: true,
  avatarUrl: null,
};

const SUPER_ADMIN: CurrentUser = {
  ...ADMIN,
  id: '33333333-3333-3333-3333-333333333333',
  roles: ['SuperAdmin'],
  permissions: [],
};

function runGuard(permissions: unknown): ReturnType<CanActivateFn> {
  const route = { data: { permissions } } as unknown as ActivatedRouteSnapshot;
  return TestBed.runInInjectionContext(() => permissionGuard(route, {} as RouterStateSnapshot));
}

describe('permissionGuard', () => {
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
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
    auth = TestBed.inject(AuthService);
  });

  it('allows a held permission', () => {
    auth.setAuthenticated({ user: ADMIN, accessToken: 'access-1' });

    expect(runGuard(['orders.read'])).toBe(true);
    expect(runGuard(['catalog.manage', 'orders.read'])).toBe(true);
  });

  it('denies unheld permissions with forbidden', () => {
    auth.setAuthenticated({ user: ADMIN, accessToken: 'access-1' });

    const result = runGuard(['catalog.manage']);
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/forbidden');
  });

  it('bypasses every gate for SuperAdmin without held permissions', () => {
    auth.setAuthenticated({ user: SUPER_ADMIN, accessToken: 'access-1' });

    expect(runGuard(['orders.read'])).toBe(true);
    expect(runGuard(['catalog.manage', 'dashboard.read'])).toBe(true);
  });

  it('does not let roles satisfy permissions', () => {
    auth.setAuthenticated({
      user: { ...ADMIN, roles: ['Admin'], permissions: [] },
      accessToken: 'access-1',
    });

    const result = runGuard(['orders.read']);
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/forbidden');
  });

  it('denies SuperAdmin on unconfigured routes (bypass never rescues fail-closed)', () => {
    auth.setAuthenticated({ user: SUPER_ADMIN, accessToken: 'access-1' });

    const result = runGuard(undefined);
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/forbidden');
  });

  it('denies anonymous callers with forbidden (login is authGuards job)', () => {
    auth.markInitializedAnonymous();

    const result = runGuard(['orders.read']);
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/forbidden');
  });

  it.each([['missing'], ['empty'], ['junk']])(
    'fails closed on %s permission configuration',
    (variant) => {
      // A permission-holding (non-SuperAdmin) session: even a held
      // permission must not rescue an unconfigured route.
      auth.setAuthenticated({
        user: { ...ADMIN, roles: ['Admin'], permissions: ['orders.read'] },
        accessToken: 'access-1',
      });
      const configured: unknown =
        variant === 'missing' ? undefined : variant === 'empty' ? [] : [42, null];

      const result = runGuard(configured);

      expect(result).toBeInstanceOf(UrlTree);
      expect((result as UrlTree).toString()).toBe('/forbidden');
    },
  );

  it('ignores non-string entries while honoring listed permissions', () => {
    auth.setAuthenticated({ user: ADMIN, accessToken: 'access-1' });

    expect(runGuard(['orders.read', 42])).toBe(true);
  });

  it('denies after a me re-sync drops the permission (demotion rule)', () => {
    auth.setAuthenticated({ user: ADMIN, accessToken: 'access-1' });
    expect(runGuard(['orders.read'])).toBe(true);

    auth.updateCurrentUser({ ...ADMIN, permissions: ['dashboard.read'] });

    const result = runGuard(['orders.read']);
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/forbidden');
  });

  it('waits out initialization, then decides once', () => {
    const result = runGuard(['orders.read']);
    expect(result).toBeInstanceOf(Observable);

    let resolved: boolean | UrlTree | undefined;
    (result as Observable<boolean | UrlTree>).subscribe((value) => {
      resolved = value;
    });
    expect(resolved).toBeUndefined();

    auth.setAuthenticated({ user: ADMIN, accessToken: 'access-1' });
    TestBed.flushEffects();
    expect(resolved).toBe(true);
  });
});
