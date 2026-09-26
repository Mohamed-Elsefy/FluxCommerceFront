/**
 * Reset-password page tests (Sub-Phase 2.10): missing tokens explain
 * themselves, confirmation drift blocks the wire body, and success prompts
 * a login without establishing a session. `AuthDataAccess` is stubbed.
 */

import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiError } from '@flux/api';
import { CultureService } from '@flux/i18n';
import { AuthDataAccess } from '../../data-access/auth-data-access';
import { ResetPasswordPage } from './reset-password-page';

@Component({ template: '<router-outlet></router-outlet>', imports: [RouterOutlet] })
class Host {}

@Component({ template: '' })
class Blank {}

async function navigate(url: string): Promise<{
  page: ResetPasswordPage | undefined;
  fixture: ComponentFixture<Host>;
}> {
  const router = TestBed.inject(Router);
  const fixture = TestBed.createComponent(Host);
  await router.navigateByUrl(url);
  await fixture.whenStable();
  fixture.detectChanges();
  const page = fixture.debugElement.children
    .map((child) => child.componentInstance as unknown)
    .find((instance) => instance instanceof ResetPasswordPage) as ResetPasswordPage | undefined;
  return { page, fixture };
}

function fillMatching(page: ResetPasswordPage, password = 'BrandNew123!'): void {
  page.form.controls.newPassword.setValue(password);
  page.form.controls.confirmPassword.setValue(password);
}

describe('ResetPasswordPage', () => {
  let resetCalls: unknown[];
  let resetResult: () => ReturnType<AuthDataAccess['resetPassword']>;

  beforeEach(() => {
    window.localStorage.clear();
    resetCalls = [];
    resetResult = () => of(undefined);
    const dataAccessStub = {
      resetPassword: ((input: unknown) => {
        resetCalls.push(input);
        return resetResult();
      }) as AuthDataAccess['resetPassword'],
    } as AuthDataAccess;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'reset-password', component: ResetPasswordPage },
          { path: 'forgot-password', component: Blank },
          { path: 'login', component: Blank },
        ]),
        { provide: AuthDataAccess, useValue: dataAccessStub },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('explains a missing token without calling the API', async () => {
    const { page, fixture } = await navigate('/reset-password');

    expect(page).toBeDefined();
    expect(resetCalls).toHaveLength(0);
    const heading = (fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent;
    expect(heading).toContain('Reset link incomplete');
  });

  it('renders localized copy without key leakage', async () => {
    const { fixture } = await navigate('/reset-password?token=reset-token-1');
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('fr');
    try {
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;

      expect(element.querySelector('h1')?.textContent).toBe('Choisir un nouveau mot de passe');
      expect(element.textContent).not.toContain('auth.');
    } finally {
      cultures.setCulture('en');
    }
  });

  it('blocks confirmation drift without calling the API', async () => {
    const { page } = await navigate('/reset-password?token=reset-token-1');
    if (page === undefined) {
      throw new Error('ResetPasswordPage did not render');
    }
    page.form.controls.newPassword.setValue('BrandNew123!');
    page.form.controls.confirmPassword.setValue('SomethingElse123!');
    page.submit();

    expect(resetCalls).toHaveLength(0);
    expect(page.form.hasError('passwordMismatch')).toBe(true);
  });

  it('submits the contract-exact body and prompts a login', async () => {
    const { page, fixture } = await navigate('/reset-password?token=reset-token-1');
    if (page === undefined) {
      throw new Error('ResetPasswordPage did not render');
    }
    fillMatching(page);
    page.submit();
    fixture.detectChanges();

    expect(resetCalls).toEqual([{ token: 'reset-token-1', newPassword: 'BrandNew123!' }]);
    const heading = (fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent;
    expect(heading).toContain('Password updated');
  });

  it('surfaces rejected tokens without navigating', async () => {
    resetResult = () =>
      throwError(() => new ApiError({ status: 401, message: 'Invalid reset token.' }));
    const { page } = await navigate('/reset-password?token=stale-token');
    if (page === undefined) {
      throw new Error('ResetPasswordPage did not render');
    }
    fillMatching(page);
    page.submit();

    expect(page.formError()).toBe('You are not authorized. Please sign in.');
    expect(page.done()).toBe(false);
    expect(page.isSubmitting()).toBe(false);
  });
});
