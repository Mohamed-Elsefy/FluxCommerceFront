/**
 * Login page tests (Sub-Phase 2.4): client-side validation blocks the flow,
 * success authenticates and honors `?returnUrl=`, and backend rejections
 * surface without navigation. `AuthDataAccess` is stubbed at its typed
 * seam (its HTTP orchestration is covered by `auth-data-access.spec.ts`);
 * the router stays real to prove navigation behavior.
 */

import { Location } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiError } from '@flux/api';
import { AuthService, type CurrentUser } from '@flux/auth';
import { AuthDataAccess } from '../data-access/auth-data-access';
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
  isEmailVerified: true,
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

  it('blocks the flow on invalid input', async () => {
    const { page } = await navigate('/login');
    page.form.controls.email.setValue('not-an-email');
    page.form.controls.password.setValue('');
    page.submit();

    expect(loginCalls).toHaveLength(0);
    expect(page.form.invalid).toBe(true);
    expect(authStub.isAuthenticated()).toBe(false);
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

    expect(page.formError()).toBe('Invalid email or password.');
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
    expect(page.formError()).toBe('One or more validation errors occurred.');
  });
});
