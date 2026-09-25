/**
 * Email verification page tests (Sub-Phase 2.10): token links verify
 * automatically, missing tokens explain themselves, and failures route to
 * the resend entry point. `AuthDataAccess` is stubbed at its typed seam.
 */

import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiError } from '@flux/api';
import { CultureService } from '@flux/i18n';
import { AuthDataAccess, type RegistrationResult } from '../../data-access/auth-data-access';
import { VerifyEmailPage } from './verify-email-page';

@Component({ template: '<router-outlet></router-outlet>', imports: [RouterOutlet] })
class Host {}

@Component({ template: '' })
class Blank {}

const RESULT: RegistrationResult = {
  email: 'ada@flux.local',
  displayName: 'Ada Lovelace',
  isEmailVerified: true,
};

async function navigate(url: string): Promise<ComponentFixture<Host>> {
  const router = TestBed.inject(Router);
  const fixture = TestBed.createComponent(Host);
  await router.navigateByUrl(url);
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

function heading(fixture: ComponentFixture<Host>): string {
  return (fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent ?? '';
}

describe('VerifyEmailPage', () => {
  let verifyCalls: unknown[];
  let verifyResult: () => ReturnType<AuthDataAccess['verifyEmail']>;

  beforeEach(() => {
    window.localStorage.clear();
    verifyCalls = [];
    verifyResult = () => of(RESULT);
    const dataAccessStub = {
      verifyEmail: ((token: unknown) => {
        verifyCalls.push(token);
        return verifyResult();
      }) as AuthDataAccess['verifyEmail'],
    } as AuthDataAccess;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'verify-email', component: VerifyEmailPage },
          { path: 'login', component: Blank },
          { path: 'resend-verification', component: Blank },
        ]),
        { provide: AuthDataAccess, useValue: dataAccessStub },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('verifies the link token and prompts a login', async () => {
    const fixture = await navigate('/verify-email?token=link-token-1');

    expect(verifyCalls).toEqual(['link-token-1']);
    expect(heading(fixture)).toContain('Email verified');
    expect(fixture.nativeElement.querySelector('p')?.textContent).toContain('ada@flux.local');
  });

  it('explains a missing token without calling the API', async () => {
    const fixture = await navigate('/verify-email');

    expect(verifyCalls).toHaveLength(0);
    expect(heading(fixture)).toContain('Verification link incomplete');
  });

  it('routes expired links to the resend entry point', async () => {
    verifyResult = () =>
      throwError(() => new ApiError({ status: 401, message: 'Invalid verification token.' }));
    const fixture = await navigate('/verify-email?token=stale-token');

    expect(verifyCalls).toEqual(['stale-token']);
    expect(heading(fixture)).toContain('Verification failed');
    const links = [...fixture.nativeElement.querySelectorAll('a')].map((anchor) =>
      (anchor as HTMLAnchorElement).getAttribute('href'),
    );
    expect(links).toContain('/resend-verification');
  });

  it('renders localized copy without key leakage', async () => {
    const fixture = await navigate('/verify-email');
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('fr');
    try {
      fixture.detectChanges();

      expect(heading(fixture)).toBe('Lien incomplet');
      expect(fixture.nativeElement.textContent).not.toContain('auth.');
    } finally {
      cultures.setCulture('en');
    }
  });
});
