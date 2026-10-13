/**
 * Login page tests (Sub-Phase 2.4): client-side validation blocks the flow,
 * success authenticates and honors `?returnUrl=`, and backend rejections
 * surface without navigation. `AuthDataAccess` is stubbed at its typed
 * seam (its HTTP orchestration is covered by `auth-data-access.spec.ts`);
 * the router stays real to prove navigation behavior.
 */

import { Location } from '@angular/common';
import { Component, DebugElement } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiError } from '@flux/api';
import { AuthService, type CurrentUser } from '@flux/auth';
import { CultureService } from '@flux/i18n';
import { AuthDataAccess } from '../../data-access/auth-data-access';
import { FieldErrors } from '../../components/field-errors/field-errors';
import { LoginPage } from './login-page';

@Component({ template: '<router-outlet></router-outlet>', imports: [RouterOutlet] })
class Host {}

@Component({ template: '' })
class Blank {}

const USER: CurrentUser = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'ada@flux.local',
  displayName: 'Ada Lovelace',
  roles: ['Customer'],
  permissions: [],
  isEmailVerified: true,
  avatarUrl: null,
};

async function navigate(url: string): Promise<{
  page: LoginPage;
  fixture: ComponentFixture<Host>;
}> {
  const router = TestBed.inject(Router);
  const fixture = TestBed.createComponent(Host);
  await router.navigateByUrl(url);
  await fixture.whenStable();
  fixture.detectChanges();
  const page = fixture.debugElement.children
    .map((child) => child.componentInstance as unknown)
    .find((instance) => instance instanceof LoginPage) as LoginPage | undefined;
  if (page === undefined) {
    throw new Error(`LoginPage did not render for ${url}`);
  }
  return { page, fixture };
}

describe('LoginPage', () => {
  let authStub: { isAuthenticated: () => boolean };
  let isAuthenticated: boolean;
  let loginCalls: unknown[];
  let loginResult: () => ReturnType<AuthDataAccess['login']>;

  beforeEach(() => {
    window.localStorage.clear();
    isAuthenticated = false;
    authStub = { isAuthenticated: () => isAuthenticated };
    loginCalls = [];
    loginResult = () => of(USER);
    const dataAccessStub = {
      login: ((body: unknown) => {
        loginCalls.push(body);
        return loginResult();
      }) as AuthDataAccess['login'],
    } as AuthDataAccess;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'login', component: LoginPage },
          { path: 'orders', component: Blank },
          { path: '', component: Blank },
        ]),
        { provide: AuthService, useValue: authStub },
        { provide: AuthDataAccess, useValue: dataAccessStub },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the login/register segmented tabs with login active', async () => {
    const { fixture } = await navigate('/login');
    const tabs = [...fixture.nativeElement.querySelectorAll('.auth-tabs a')];

    expect(tabs.map((tab) => (tab as HTMLAnchorElement).getAttribute('href'))).toEqual([
      '/login',
      '/register',
    ]);
    expect(tabs[0]?.classList.contains('active')).toBe(true);
    expect(tabs[1]?.classList.contains('active')).toBe(false);
  });

  it('toggles password visibility without submitting', async () => {
    const { fixture } = await navigate('/login');
    const input = fixture.nativeElement.querySelector('#login-password') as HTMLInputElement | null;
    const toggle = fixture.nativeElement.querySelector(
      '.auth-password-toggle',
    ) as HTMLButtonElement | null;

    expect(input?.getAttribute('type')).toBe('password');
    expect(toggle?.getAttribute('aria-label')).toBe('Show password');

    toggle?.click();
    fixture.detectChanges();

    expect(input?.getAttribute('type')).toBe('text');
    expect(toggle?.getAttribute('aria-label')).toBe('Hide password');
    expect(toggle?.getAttribute('aria-pressed')).toBe('true');
  });

  it('blocks the flow on invalid input', async () => {
    const { page } = await navigate('/login');
    page.form.controls.email.setValue('not-an-email');
    page.form.controls.password.setValue('');
    page.submit();

    expect(loginCalls).toHaveLength(0);
    expect(page.form.invalid).toBe(true);
    expect(authStub.isAuthenticated()).toBe(false);
  });

  it('renders localized copy without key leakage', async () => {
    const { fixture } = await navigate('/login');
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('fr');
    try {
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;

      expect(element.querySelector('h1')?.textContent).toBe('Se connecter');
      expect(element.textContent).not.toContain('auth.');
    } finally {
      cultures.setCulture('en');
    }
  });

  it('localizes form and field errors for the active culture (11.10)', async () => {
    TestBed.inject(CultureService).setCulture('fr');
    try {
      loginResult = () => throwError(() => new ApiError({ status: 401, message: 'Invalid.' }));
      const { page, fixture } = await navigate('/login');
      page.form.controls.email.setValue('ada@flux.local');
      page.form.controls.password.setValue('');
      fixture.nativeElement.querySelector('form')?.dispatchEvent(new Event('submit'));
      fixture.detectChanges();

      // Client-side validation resolves through common.validation.*.
      const fieldErrors = fixture.debugElement
        .queryAll(By.directive(FieldErrors))
        .map((node: DebugElement) => node.componentInstance as FieldErrors);
      expect(fieldErrors.length).toBeGreaterThan(0);
      expect(fieldErrors.flatMap((instance: FieldErrors) => instance.messages())).toContain(
        'Ce champ est obligatoire.',
      );
      expect(fixture.nativeElement.textContent).toContain('Ce champ est obligatoire.');
      page.form.controls.password.setValue('Valid123!');
      fixture.nativeElement.querySelector('form')?.dispatchEvent(new Event('submit'));
      fixture.detectChanges();

      // Form-level failures resolve through errors.* (never backend text).
      expect(page.formError()).toBe("Vous n'êtes pas autorisé. Veuillez vous connecter.");
    } finally {
      TestBed.inject(CultureService).setCulture('en');
    }
  });

  it('bounces already-authenticated visits to the return URL', async () => {
    isAuthenticated = true;
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(Host);
    await router.navigateByUrl('/login?returnUrl=/orders');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(TestBed.inject(Location).path()).toBe('/orders');
  });

  it('redirects to the return URL on success', async () => {
    const { page, fixture } = await navigate('/login?returnUrl=/orders');
    page.form.controls.email.setValue('ada@flux.local');
    page.form.controls.password.setValue('Valid123!');
    page.submit();

    expect(loginCalls).toEqual([{ email: 'ada@flux.local', password: 'Valid123!' }]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(TestBed.inject(Location).path()).toBe('/orders');
  });

  it('surfaces backend rejections without navigating', async () => {
    loginResult = () =>
      throwError(() => new ApiError({ status: 401, message: 'Invalid email or password.' }));
    const { page } = await navigate('/login');
    page.form.controls.email.setValue('ada@flux.local');
    page.form.controls.password.setValue('Wrong123!');
    page.submit();

    expect(page.formError()).toBe('You are not authorized. Please sign in.');
    expect(page.isSubmitting()).toBe(false);
    expect(authStub.isAuthenticated()).toBe(false);
    expect(TestBed.inject(Location).path()).toBe('/login');
  });

  it('maps backend field errors onto matching controls', async () => {
    loginResult = () =>
      throwError(
        () =>
          new ApiError({
            status: 400,
            message: 'One or more validation errors occurred.',
            validationErrors: { Email: ['Email is already taken.'] },
          }),
      );
    const { page } = await navigate('/login');
    page.form.controls.email.setValue('ada@flux.local');
    page.form.controls.password.setValue('Valid123!');
    page.submit();

    expect(page.form.controls.email.hasError('server')).toBe(true);
    expect(page.formError()).toBe(
      'Please correct the highlighted fields and try again. Email: Email is already taken.',
    );
  });
});
