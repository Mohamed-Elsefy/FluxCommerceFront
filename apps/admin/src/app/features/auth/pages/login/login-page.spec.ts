/**
 * Admin login page tests (Sub-Phase 12.1): client-side validation blocks
 * the flow, backend rejections surface without navigation, and
 * already-authenticated visits bounce to the return URL.
 * `AdminAuthDataAccess` is stubbed at its typed seam (its HTTP
 * orchestration is covered by `admin-auth-data-access.spec.ts`);
 * `AuthService` is stubbed to its `isAuthenticated` selector (guard
 * behavior is covered by `libs/auth` specs and the admin E2E suite);
 * routing is stubbed to `navigateByUrl` plus a param map (navigation
 * behavior is covered E2E).
 */

import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { throwError, type Observable } from 'rxjs';
import { ApiError } from '@flux/api';
import { AuthService, type CurrentUser } from '@flux/auth';
import { CultureService } from '@flux/i18n';
import { AdminAuthDataAccess } from '../../data-access/admin-auth-data-access';
import { AdminLoginPage } from './login-page';

describe('AdminLoginPage', () => {
  let isAuthenticated: boolean;
  let loginImpl: () => Observable<CurrentUser>;
  let navigateByUrl: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    isAuthenticated = false;
    loginImpl = () =>
      throwError(() => new ApiError({ status: 401, code: 'x', message: 'Invalid credentials.' }));
    navigateByUrl = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [
        AdminLoginPage,
        { provide: Router, useValue: { navigateByUrl } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({}) },
          },
        },
        { provide: AuthService, useValue: { isAuthenticated: () => isAuthenticated } },
        {
          provide: AdminAuthDataAccess,
          useValue: { login: () => loginImpl() },
        },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('blocks submission when the form is invalid', () => {
    const page = TestBed.inject(AdminLoginPage);

    page.submit();

    expect(page.form.invalid).toBe(true);
    expect(page.formError()).toBeNull();
    expect(page.isSubmitting()).toBe(false);
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('surfaces failure and releases the submit lock', () => {
    const page = TestBed.inject(AdminLoginPage);

    page.form.setValue({ email: 'boss@flux.local', password: 'wrong-password' });
    page.submit();

    expect(page.isSubmitting()).toBe(false);
    expect(page.formError()).not.toBeNull();
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('bounces already-authenticated visits to the return URL', () => {
    isAuthenticated = true;

    TestBed.inject(AdminLoginPage);

    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('renders localized copy for the active culture', () => {
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('fr');
    try {
      const fixture = TestBed.createComponent(AdminLoginPage);
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;

      expect(element.querySelector('h1')?.textContent).toBe('Connexion admin');
      expect(element.querySelector('.admin-login-submit')?.textContent?.trim()).toBe(
        'Se connecter',
      );
    } finally {
      cultures.setCulture('en');
    }
  });
});
