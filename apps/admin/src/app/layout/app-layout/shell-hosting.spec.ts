/**
 * Shell-hosting integration tests for Sub-Phase 12.2 — Admin Application
 * Architecture & Shell.
 *
 * Proves the structural contract using the real route table (`app.routes`)
 * and the real eager shell (`AppLayout`) with stubbed HTTP (no backend):
 *
 * ```text
 * /login, /forbidden → public pages rendered OUTSIDE the shell
 * / (+ children)     → protected shell hosting nested feature pages
 *                       inside `main > router-outlet`
 * ```
 *
 * Auth state is settled directly on the shared `AuthService` (its guard
 * behavior is covered by `libs/auth` specs and the admin E2E suite); the
 * router stays real so layout routes, nesting, and outlet hosting run for
 * real. Shell chrome itself (sidebar/header/drawer) is covered by the
 * colocated component specs — this file owns the shell/feature boundary.
 */

import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { provideApi, provideAppEnvironment } from '@flux/api';
import { AuthService, type CurrentUser } from '@flux/auth';
import { App } from '../../app';
import { routes } from '../../app.routes';

function adminUser(roles: readonly string[]): CurrentUser {
  return {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'boss@flux.local',
    displayName: 'Boss Admin',
    roles,
    isEmailVerified: true,
  };
}

async function setupAs(
  state: 'anonymous' | 'admin' | 'customer',
): Promise<{ fixture: ComponentFixture<App>; router: Router; element: HTMLElement }> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      provideAppEnvironment({
        name: 'development',
        production: false,
        appName: 'test',
        apiBaseUrl: '/api',
      }),
      provideApi(),
      provideHttpClientTesting(),
    ],
  });
  window.localStorage.clear();
  const auth = TestBed.inject(AuthService);
  if (state === 'anonymous') {
    auth.markInitializedAnonymous();
  } else {
    auth.setAuthenticated({
      user: adminUser(state === 'admin' ? ['Admin'] : ['Customer']),
      accessToken: 'test-access-token',
    });
  }
  const router = TestBed.inject(Router);
  const fixture = TestBed.createComponent(App);
  // Run the initial navigation TestBed skips: without it the first
  // `navigateByUrl('/')` is a same-URL no-op and guards never run.
  router.initialNavigation();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, router, element: fixture.nativeElement as HTMLElement };
}

async function navigate(
  router: Router,
  fixture: ComponentFixture<App>,
  url: string,
): Promise<HTMLElement> {
  await router.navigateByUrl(url);
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('AdminShell hosting', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('hosts the dashboard feature inside the shell outlet for admins', async () => {
    const { fixture, router } = await setupAs('admin');

    const element = await navigate(router, fixture, '/dashboard');

    expect(element.querySelector('app-layout')).not.toBeNull();
    expect(element.querySelector('main#admin-main h1')?.textContent).toContain('Dashboard');
  });

  it('keeps the shell mounted while swapping nested features', async () => {
    const { fixture, router } = await setupAs('admin');

    let element = await navigate(router, fixture, '/');
    expect(element.querySelector('main#admin-main h1')?.textContent).toContain('Admin');

    element = await navigate(router, fixture, '/dashboard');
    expect(element.querySelector('app-layout')).not.toBeNull();
    expect(element.querySelector('main#admin-main h1')?.textContent).toContain('Dashboard');
  });

  it('renders the login page outside the shell for anonymous visits', async () => {
    const { fixture, router } = await setupAs('anonymous');

    const element = await navigate(router, fixture, '/');

    expect(router.url).toContain('/login');
    expect(element.querySelector('app-layout')).toBeNull();
    expect(element.querySelector('h1')?.textContent).toContain('Admin sign in');
  });

  it('renders the denial page outside the shell for non-admin users', async () => {
    const { fixture, router } = await setupAs('customer');

    const element = await navigate(router, fixture, '/dashboard');

    expect(router.url).toContain('/forbidden');
    expect(element.querySelector('app-layout')).toBeNull();
    expect(element.querySelector('h1')?.textContent).toContain('Access denied');
  });
});
