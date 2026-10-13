/**
 * Registration page tests (Sub-Phase 2.4): client-side validation blocks
 * the flow, success swaps to the pending-verification state without
 * authenticating, and conflicts surface as form errors. `AuthDataAccess`
 * is stubbed at its typed seam (covered by `auth-data-access.spec.ts`).
 */

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiError } from '@flux/api';
import { AuthService } from '@flux/auth';
import { CultureService } from '@flux/i18n';
import { AuthDataAccess, type RegistrationResult } from '../../data-access/auth-data-access';
import { RegisterPage } from './register-page';

const RESULT: RegistrationResult = {
  email: 'ada@flux.local',
  displayName: 'Ada Lovelace',
  isEmailVerified: false,
};

function fillValid(page: RegisterPage): void {
  page.form.controls.email.setValue('ada@flux.local');
  page.form.controls.password.setValue('Valid123!');
  page.form.controls.firstName.setValue('Ada');
  page.form.controls.lastName.setValue('Lovelace');
}

describe('RegisterPage', () => {
  let authStub: { isAuthenticated: () => boolean };
  let registerCalls: unknown[];
  let registerResult: () => ReturnType<AuthDataAccess['register']>;

  beforeEach(() => {
    window.localStorage.clear();
    authStub = { isAuthenticated: () => false };
    registerCalls = [];
    registerResult = () => of(RESULT);
    const dataAccessStub = {
      register: ((body: unknown) => {
        registerCalls.push(body);
        return registerResult();
      }) as AuthDataAccess['register'],
    } as AuthDataAccess;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authStub },
        { provide: AuthDataAccess, useValue: dataAccessStub },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the login/register segmented tabs', () => {
    const fixture = TestBed.createComponent(RegisterPage);
    fixture.detectChanges();
    const tabs = [...fixture.nativeElement.querySelectorAll('.auth-tabs a')];

    expect(tabs.map((tab) => (tab as HTMLAnchorElement).getAttribute('href'))).toEqual([
      '/login',
      '/register',
    ]);
  });

  it('toggles password visibility without submitting', () => {
    const fixture = TestBed.createComponent(RegisterPage);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector(
      '#register-password',
    ) as HTMLInputElement | null;
    const toggle = fixture.nativeElement.querySelector(
      '.auth-password-toggle',
    ) as HTMLButtonElement | null;

    expect(input?.getAttribute('type')).toBe('password');

    toggle?.click();
    fixture.detectChanges();

    expect(input?.getAttribute('type')).toBe('text');
    expect(toggle?.getAttribute('aria-pressed')).toBe('true');
  });

  it('blocks the flow on invalid input', () => {
    const fixture = TestBed.createComponent(RegisterPage);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    page.form.controls.password.setValue('weak');
    page.submit();

    expect(registerCalls).toHaveLength(0);
    expect(page.form.invalid).toBe(true);
    expect(page.result()).toBeNull();
  });

  it('shows the pending-verification state without authenticating', () => {
    const fixture = TestBed.createComponent(RegisterPage);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    fillValid(page);
    page.submit();

    expect(registerCalls).toEqual([
      {
        email: 'ada@flux.local',
        password: 'Valid123!',
        firstName: 'Ada',
        lastName: 'Lovelace',
      },
    ]);
    fixture.detectChanges();

    expect(page.result()?.email).toBe('ada@flux.local');
    expect(page.result()?.isEmailVerified).toBe(false);
    expect(authStub.isAuthenticated()).toBe(false);
    const heading = (fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent;
    expect(heading).toContain('Check your inbox');
  });

  it('renders localized copy without key leakage', () => {
    const fixture = TestBed.createComponent(RegisterPage);
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('fr');
    try {
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;

      expect(element.querySelector('h1')?.textContent).toBe('Créer un compte');
      expect(element.textContent).not.toContain('auth.');
    } finally {
      cultures.setCulture('en');
    }
  });

  it('surfaces duplicate-email conflicts as form errors', () => {
    registerResult = () =>
      throwError(
        () => new ApiError({ status: 409, message: 'An account with this email already exists.' }),
      );
    const fixture = TestBed.createComponent(RegisterPage);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    fillValid(page);
    page.submit();
    fixture.detectChanges();

    expect(page.formError()).toBe('An unexpected error occurred.');
    expect(page.result()).toBeNull();
    expect(page.isSubmitting()).toBe(false);
    expect(authStub.isAuthenticated()).toBe(false);
  });
});
