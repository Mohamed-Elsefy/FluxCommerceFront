/**
 * Authentication guard tests for Sub-Phase 2.11.
 *
 * The guard runs in a real `TestBed` injection context against a real
 * `AuthService`; snapshots are minimal fakes carrying only what the guard
 * reads (`RouterStateSnapshot.url`). Proves the decision table: immediate
 * allow, immediate login redirect with `returnUrl`, and deferred
 * decisions that never mistake `initializing` for anonymous.
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
import { authGuard } from './auth.guard';

const USER: CurrentUser = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'ada@flux.local',
  displayName: 'Ada Lovelace',
  roles: ['Customer'],
  permissions: [],
  isEmailVerified: true,
};

function runGuard(url: string): ReturnType<CanActivateFn> {
  const snapshot = { url } as RouterStateSnapshot;
  return TestBed.runInInjectionContext(() => authGuard({} as ActivatedRouteSnapshot, snapshot));
}

describe('authGuard', () => {
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
    // Real router (no app HTTP needed — the guard reads state only).
    auth = TestBed.inject(AuthService);
  });

  it('allows authenticated navigation synchronously', () => {
    auth.setAuthenticated({ user: USER, accessToken: 'access-1' });

    expect(runGuard('/orders')).toBe(true);
  });

  it('redirects anonymous navigation to login with the return URL', () => {
    auth.markInitializedAnonymous();

    const result = runGuard('/orders?page=2');
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/login?returnUrl=%2Forders%3Fpage%3D2');
  });

  it('waits out initialization, then allows on authenticated restore', () => {
    const result = runGuard('/account');
    expect(result).toBeInstanceOf(Observable);

    let resolved: boolean | UrlTree | undefined;
    (result as Observable<boolean | UrlTree>).subscribe((value) => {
      resolved = value;
    });
    expect(resolved).toBeUndefined();

    auth.setAuthenticated({ user: USER, accessToken: 'access-1' });
    TestBed.flushEffects();
    expect(resolved).toBe(true);
  });

  it('waits out initialization, then redirects on anonymous restore', () => {
    const result = runGuard('/account');
    expect(result).toBeInstanceOf(Observable);

    let resolved: boolean | UrlTree | undefined;
    (result as Observable<boolean | UrlTree>).subscribe((value) => {
      resolved = value;
    });
    expect(resolved).toBeUndefined();

    auth.markInitializedAnonymous();
    TestBed.flushEffects();
    expect(resolved).toBeInstanceOf(UrlTree);
    expect((resolved as UrlTree).toString()).toBe('/login?returnUrl=%2Faccount');
  });
});
