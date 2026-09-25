/**
 * Forgot-password page tests (Sub-Phase 2.10): invalid input blocks the
 * flow and every valid submission lands on the same confirmation panel
 * (anti-enumeration). `AuthDataAccess` is stubbed.
 */

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiError } from '@flux/api';
import { AuthDataAccess } from '../../data-access/auth-data-access';
import { ForgotPasswordPage } from './forgot-password-page';

describe('ForgotPasswordPage', () => {
  let forgotCalls: unknown[];
  let forgotResult: () => ReturnType<AuthDataAccess['forgotPassword']>;

  beforeEach(() => {
    forgotCalls = [];
    forgotResult = () => of(undefined);
    const dataAccessStub = {
      forgotPassword: ((email: unknown) => {
        forgotCalls.push(email);
        return forgotResult();
      }) as AuthDataAccess['forgotPassword'],
    } as AuthDataAccess;
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthDataAccess, useValue: dataAccessStub }],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('blocks the flow on invalid input', () => {
    const fixture = TestBed.createComponent(ForgotPasswordPage);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    page.form.controls.email.setValue('not-an-email');
    page.submit();

    expect(forgotCalls).toHaveLength(0);
    expect(page.form.invalid).toBe(true);
    expect(page.sentTo()).toBeNull();
  });

  it('confirms unconditionally on success', () => {
    const fixture = TestBed.createComponent(ForgotPasswordPage);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    page.form.controls.email.setValue('unknown@flux.local');
    page.submit();
    fixture.detectChanges();

    expect(forgotCalls).toEqual(['unknown@flux.local']);
    const heading = (fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent;
    expect(heading).toContain('Check your inbox');
  });

  it('surfaces transport failures as form errors', () => {
    forgotResult = () => throwError(() => new ApiError({ status: 0, message: 'Offline.' }));
    const fixture = TestBed.createComponent(ForgotPasswordPage);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    page.form.controls.email.setValue('ada@flux.local');
    page.submit();
    fixture.detectChanges();

    expect(page.formError()).toBe('An unexpected error occurred.');
    expect(page.sentTo()).toBeNull();
    expect(page.isSubmitting()).toBe(false);
  });
});
