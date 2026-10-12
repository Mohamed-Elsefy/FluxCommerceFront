/**
 * Role guard tests for Sub-Phase 2.12.
 *
 * Runs in a real `TestBed` injection context against a real `AuthService`;
 * route snapshots are minimal fakes carrying only `data`. Proves the
 * evaluation table: OR-semantics allow, strict claims (no implication),
 * fail-closed configuration, anonymous denial, and deferred decisions
 * during initialization.
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
import { roleGuard } from './role.guard';

const ADMIN: CurrentUser = {
  id: '22222222-2222-2222-2222-222222222222',
  email: 'boss@flux.local',
  displayName: 'Boss',
  roles: ['Admin'],
  permissions: [],
  isEmailVerified: true,
  avatarUrl: null,
};

const SUPER_ADMIN: CurrentUser = {
  ...ADMIN,
  id: '33333333-3333-3333-3333-333333333333',
  roles: ['SuperAdmin'],
};

function runGuard(roles: unknown): ReturnType<CanActivateFn> {
  const route = { data: { roles } } as unknown as ActivatedRouteSnapshot;
  return TestBed.runInInjectionContext(() => roleGuard(route, {} as RouterStateSnapshot));
}

describe('roleGuard', () => {
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

  it('allows a listed role', () => {
    auth.setAuthenticated({ user: ADMIN, accessToken: 'access-1' });

    expect(runGuard(['Admin'])).toBe(true);
    expect(runGuard(['Customer', 'Admin'])).toBe(true);
  });

  it('denies unlisted roles without implying SuperAdmin powers', () => {
    auth.setAuthenticated({ user: SUPER_ADMIN, accessToken: 'access-1' });

    const result = runGuard(['Admin']);
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/forbidden');
  });

  it('denies customers on admin routes', () => {
    auth.setAuthenticated({
      user: { ...ADMIN, roles: ['Customer'] },
      accessToken: 'access-1',
    });

    const result = runGuard(['Admin', 'SuperAdmin']);
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/forbidden');
  });

  it('denies anonymous callers with forbidden (login is authGuards job)', () => {
    auth.markInitializedAnonymous();

    const result = runGuard(['Admin']);
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/forbidden');
  });

  it.each([['missing'], ['empty'], ['junk']])(
    'fails closed on %s role configuration',
    (variant) => {
      auth.setAuthenticated({ user: SUPER_ADMIN, accessToken: 'access-1' });
      const configured: unknown =
        variant === 'missing' ? undefined : variant === 'empty' ? [] : [42, null];

      const result = runGuard(configured);

      expect(result).toBeInstanceOf(UrlTree);
      expect((result as UrlTree).toString()).toBe('/forbidden');
    },
  );

  it('ignores non-string entries while honoring listed roles', () => {
    auth.setAuthenticated({ user: ADMIN, accessToken: 'access-1' });

    expect(runGuard(['Admin', 42])).toBe(true);
  });

  it('waits out initialization, then decides once', () => {
    const result = runGuard(['Admin']);
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
