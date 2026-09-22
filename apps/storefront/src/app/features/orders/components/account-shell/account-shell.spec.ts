/**
 * Component tests for the Sub-Phase 10.2 `AccountShell`.
 *
 * Covers shell composition only (section heading, signed-in identity
 * line, section navigation items, logout single-flight, child outlet):
 * authentication state itself stays in `AuthService` (stubbed to its
 * readonly signals + `logout` seam), copy stays in the account bundle,
 * and profile content stays in the child pages behind the outlet.
 */

import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { of, Subject } from 'rxjs';
import { AuthService, type CurrentUser } from '@flux/auth';
import { CultureService } from '@flux/i18n';
import { AccountShell } from './account-shell';

const USER: CurrentUser = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'ada@flux.local',
  displayName: 'Ada Lovelace',
  roles: ['Customer'],
  isEmailVerified: true,
};

async function setup(
  user: CurrentUser | null = USER,
  logout: ReturnType<typeof vi.fn> = vi.fn(() => of(undefined)),
): Promise<{
  fixture: ComponentFixture<AccountShell>;
  logout: ReturnType<typeof vi.fn>;
}> {
  const currentUser = signal(user);

  await TestBed.configureTestingModule({
    imports: [AccountShell],
    providers: [
      provideRouter([]),
      CultureService,
      { provide: AuthService, useValue: { currentUser, logout } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(AccountShell);
  TestBed.inject(CultureService).setCulture('en');
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, logout };
}

function textOf(fixture: ComponentFixture<AccountShell>, selector: string): string | null {
  return fixture.nativeElement.querySelector(selector)?.textContent?.trim() ?? null;
}

describe('AccountShell', () => {
  it('renders the section heading and navigation entries', async () => {
    const { fixture } = await setup();

    expect(textOf(fixture, 'h1')).toBe('My account');
    const links = [...fixture.nativeElement.querySelectorAll('account-nav a')];
    expect(links.map((link: HTMLAnchorElement) => link.textContent?.trim())).toEqual([
      'Profile',
      'Orders',
    ]);
    expect(links.map((link: HTMLAnchorElement) => link.getAttribute('href'))).toEqual([
      '/account/profile',
      '/account/orders',
    ]);
  });

  it('shows the signed-in identity line from the session (read-only)', async () => {
    const { fixture } = await setup();
    expect(textOf(fixture, '.account-shell-user')).toBe('Signed in as ada@flux.local');
  });

  it('hides the identity line without a session user', async () => {
    const { fixture } = await setup(null);
    expect(fixture.nativeElement.querySelector('.account-shell-user')).toBeNull();
  });

  it('hosts the child outlet for section pages', async () => {
    const { fixture } = await setup();
    expect(fixture.nativeElement.querySelector('router-outlet')).not.toBeNull();
  });

  it('signs out once per activation (single-flight logout)', async () => {
    const pending = new Subject<void>();
    const { fixture, logout } = await setup(
      USER,
      vi.fn(() => pending.asObservable()),
    );
    const button = fixture.nativeElement.querySelector(
      '.account-shell-logout',
    ) as HTMLButtonElement;

    button.click();
    button.click();
    expect(logout).toHaveBeenCalledTimes(1);

    pending.next();
    pending.complete();
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
  });

  it('disables the action with progress copy while signing out', async () => {
    const pending = new Subject<void>();
    const { fixture, logout } = await setup(
      USER,
      vi.fn(() => pending.asObservable()),
    );

    const button = fixture.nativeElement.querySelector(
      '.account-shell-logout',
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    expect(button.disabled).toBe(true);
    expect(button.textContent?.trim()).toBe('Signing out…');

    pending.next();
    pending.complete();
    fixture.detectChanges();
    expect(logout).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(false);
    expect(button.textContent?.trim()).toBe('Sign out');
  });
});
