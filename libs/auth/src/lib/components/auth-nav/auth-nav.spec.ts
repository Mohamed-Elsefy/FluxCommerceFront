/**
 * Shell navigation widget tests for Sub-Phase 2.14.
 *
 * Proves reactive presentation of every nav-owned state (initializing,
 * anonymous, authenticated, logout loading) against a real `AuthService`,
 * link visibility per route inputs, single-fire logout with progress copy,
 * and — as a security regression — that rendered markup never contains
 * token material.
 */

import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { provideApi, provideAppEnvironment } from '@flux/api';
import { AuthService, type CurrentUser } from '@flux/auth';
import { AuthNav } from './auth-nav';

const USER: CurrentUser = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'ada@flux.local',
  displayName: 'Ada Lovelace',
  roles: ['Customer'],
  permissions: [],
  isEmailVerified: true,
};

function setup(): { auth: AuthService } {
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
  window.localStorage.clear();
  return { auth: TestBed.inject(AuthService) };
}

function textOf(fixture: { nativeElement: HTMLElement }): string {
  return fixture.nativeElement.textContent ?? '';
}

describe('AuthNav', () => {
  let auth: AuthService;

  beforeEach(() => {
    ({ auth } = setup());
  });

  it('renders the neutral placeholder while initializing', () => {
    const fixture = TestBed.createComponent(AuthNav);
    fixture.detectChanges();

    expect(textOf(fixture)).toContain('Checking session');
    expect(fixture.nativeElement.querySelector('a')).toBeNull();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('renders login and register links when anonymous', () => {
    auth.markInitializedAnonymous();
    const fixture = TestBed.createComponent(AuthNav);
    fixture.detectChanges();

    const links = [...fixture.nativeElement.querySelectorAll('a')].map((anchor) =>
      (anchor as HTMLAnchorElement).textContent?.trim(),
    );
    expect(links).toEqual(['Login', 'Register']);
  });

  it('hides links for apps without those routes', () => {
    auth.markInitializedAnonymous();
    const fixture = TestBed.createComponent(AuthNav);
    fixture.componentInstance.loginRoute = null;
    fixture.componentInstance.registerRoute = null;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('a')).toBeNull();
  });

  it('renders user details, account entry, and logout when authenticated', () => {
    auth.setAuthenticated({ user: USER, accessToken: 'access-token-1' });
    const fixture = TestBed.createComponent(AuthNav);
    fixture.componentInstance.accountRoute = '/dashboard';
    fixture.detectChanges();

    expect(textOf(fixture)).toContain('Ada Lovelace');
    const links = [...fixture.nativeElement.querySelectorAll('a')].map((anchor) =>
      (anchor as HTMLAnchorElement).textContent?.trim(),
    );
    expect(links).toEqual(['Account']);
    expect(fixture.nativeElement.querySelector('button')?.textContent?.trim()).toBe('Logout');
  });

  it('fires logout once with progress copy and resets afterwards', () => {
    auth.setAuthenticated({ user: USER, accessToken: 'access-token-1' });
    const fixture = TestBed.createComponent(AuthNav);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    const pending = new Subject<void>();
    const logout = vi.spyOn(auth, 'logout').mockReturnValue(pending);

    page.logout();
    page.logout();
    expect(logout).toHaveBeenCalledTimes(1);
    expect(logout).toHaveBeenCalledWith({ redirectTo: undefined });
    expect(page.isLoggingOut()).toBe(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button')?.textContent?.trim()).toBe('Signing out…');
    expect(fixture.nativeElement.querySelector('button')?.disabled).toBe(true);

    pending.next();
    pending.complete();
    expect(page.isLoggingOut()).toBe(false);
  });

  it('forwards a custom post-logout destination to the session logout', () => {
    auth.setAuthenticated({ user: USER, accessToken: 'access-token-1' });
    const fixture = TestBed.createComponent(AuthNav);
    const page = fixture.componentInstance;
    page.logoutRedirectTo = '/login';
    fixture.detectChanges();
    const logout = vi.spyOn(auth, 'logout').mockReturnValue(new Subject<void>());

    page.logout();

    expect(logout).toHaveBeenCalledWith({ redirectTo: '/login' });
  });

  it('never renders token material', () => {
    auth.setAuthenticated({ user: USER, accessToken: 'access-token-SECRET' });
    TestBed.inject(AuthService).replaceAccessToken('rotated-SECRET');
    window.localStorage.setItem('probe', 'refresh-token-SECRET');
    const fixture = TestBed.createComponent(AuthNav);
    fixture.detectChanges();

    const rendered = textOf(fixture);
    expect(rendered).not.toContain('SECRET');
    expect(fixture.nativeElement.innerHTML).not.toContain('SECRET');
    window.localStorage.removeItem('probe');
  });
});
