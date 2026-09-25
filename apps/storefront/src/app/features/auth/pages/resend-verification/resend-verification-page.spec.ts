/**
 * Resend-verification page tests (Sub-Phase 2.10): invalid input blocks
 * the flow, success branches on the backend `emailSent` receipt, and
 * failures surface as form errors. `AuthDataAccess` is stubbed.
 */

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiError } from '@flux/api';
import type { ResendVerificationResponse } from '@flux/models';
import { AuthDataAccess } from '../../data-access/auth-data-access';
import { ResendVerificationPage } from './resend-verification-page';

const RECEIPT: ResendVerificationResponse = {
  emailSent: true,
  expiresAtUtc: '2026-09-07T12:00:00Z',
};

describe('ResendVerificationPage', () => {
  let resendCalls: unknown[];
  let resendResult: () => ReturnType<AuthDataAccess['resendVerification']>;

  beforeEach(() => {
    resendCalls = [];
    resendResult = () => of(RECEIPT);
    const dataAccessStub = {
      resendVerification: ((email: unknown) => {
        resendCalls.push(email);
        return resendResult();
      }) as AuthDataAccess['resendVerification'],
    } as AuthDataAccess;
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthDataAccess, useValue: dataAccessStub }],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('blocks the flow on invalid input', () => {
    const fixture = TestBed.createComponent(ResendVerificationPage);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    page.form.controls.email.setValue('not-an-email');
    page.submit();

    expect(resendCalls).toHaveLength(0);
    expect(page.form.invalid).toBe(true);
    expect(page.receipt()).toBeNull();
  });

  it('confirms the send without distinguishing accounts', () => {
    const fixture = TestBed.createComponent(ResendVerificationPage);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    page.form.controls.email.setValue('ada@flux.local');
    page.submit();
    fixture.detectChanges();

    expect(resendCalls).toEqual(['ada@flux.local']);
    const heading = (fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent;
    expect(heading).toContain('Verification email sent');
  });

  it('directs already-verified accounts to sign in', () => {
    resendResult = () => of({ emailSent: false });
    const fixture = TestBed.createComponent(ResendVerificationPage);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    page.form.controls.email.setValue('ada@flux.local');
    page.submit();
    fixture.detectChanges();

    const body = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(body).toContain('already verified');
  });

  it('surfaces backend failures as form errors', () => {
    resendResult = () =>
      throwError(() => new ApiError({ status: 400, message: 'Invalid email address.' }));
    const fixture = TestBed.createComponent(ResendVerificationPage);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    page.form.controls.email.setValue('ada@flux.local');
    page.submit();
    fixture.detectChanges();

    expect(page.formError()).toBe('An unexpected error occurred.');
    expect(page.receipt()).toBeNull();
    expect(page.isSubmitting()).toBe(false);
  });
});
