/**
 * Page tests for the Sub-Phase 10.2 `ProfilePage`.
 *
 * Covers page orchestration only (projection lives in
 * `account.models.spec.ts`, resource rules in `account-state.spec.ts`,
 * transport in `libs/api` specs): the loading shell before the profile
 * settles, error rendering with retry recovery, loaded rendering of the
 * read-only profile rows, the single-request guarantee across the
 * `ngOnInit` + `afterNextRender` triggers, and localized copy with the
 * document title.
 *
 * The real `AccountState`, `AuthService` session seam (stubbed), and
 * `CultureService` are wired to a stubbed `IdentityApiService`
 * transport, so these tests pin the full page → state → data-access
 * delegation path without HTTP.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { of, Subject, throwError, type Observable } from 'rxjs';
import { ApiError, IdentityApiService, type ApiResponseWithData } from '@flux/api';
import { AuthService } from '@flux/auth';
import { CultureService } from '@flux/i18n';
import type { UserResponse } from '@flux/models';
import { AccountState } from '../../state/account-state';
import { ProfilePage } from './profile-page';

const USER_ID = '22222222-2222-4222-8222-222222222222';

function user(overrides: Partial<UserResponse> = {}): UserResponse {
  return {
    id: USER_ID,
    email: 'ada@flux.local',
    roles: ['Customer'],
    isEmailVerified: true,
    registeredAtUtc: '2026-09-04T10:00:00Z',
    firstName: 'Ada',
    lastName: 'Lovelace',
    displayName: 'Ada Lovelace',
    phoneNumber: null,
    isPhoneVerified: false,
    avatarUrl: null,
    preferredLanguage: 'en',
    timeZone: 'UTC',
    status: 1,
    ...overrides,
  };
}

function envelope(data: UserResponse | null): ApiResponseWithData<UserResponse> {
  return { isSuccess: true, data };
}

async function setup(
  source: () => Observable<ApiResponseWithData<UserResponse>> = () => of(envelope(user())),
): Promise<{
  fixture: ComponentFixture<ProfilePage>;
  identity: { getCurrentUser: ReturnType<typeof vi.fn> };
}> {
  const identity = { getCurrentUser: vi.fn(source) };

  await TestBed.configureTestingModule({
    imports: [ProfilePage],
    providers: [
      provideRouter([]),
      CultureService,
      AccountState,
      { provide: IdentityApiService, useValue: identity },
      { provide: AuthService, useValue: { updateCurrentUser: vi.fn() } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(ProfilePage);
  TestBed.inject(CultureService).setCulture('en');
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, identity };
}

function textOf(fixture: ComponentFixture<ProfilePage>, selector: string): string | null {
  return fixture.nativeElement.querySelector(selector)?.textContent?.trim() ?? null;
}

describe('ProfilePage loading', () => {
  it('renders the loading shell before the profile settles', async () => {
    const pending = new Subject<ApiResponseWithData<UserResponse>>();
    const { fixture } = await setup(() => pending.asObservable());

    expect(fixture.nativeElement.querySelector('flux-loading-indicator')).not.toBeNull();
    expect(textOf(fixture, 'h1')).toBe('Profile');

    pending.next(envelope(user()));
    pending.complete();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('flux-loading-indicator')).toBeNull();
    expect(fixture.nativeElement.querySelector('dl')).not.toBeNull();
  });

  it('issues exactly one profile request across init triggers', async () => {
    const { identity } = await setup();
    expect(identity.getCurrentUser).toHaveBeenCalledTimes(1);
  });
});

describe('ProfilePage loaded profile (read-only)', () => {
  it('renders backend profile rows verbatim', async () => {
    const { fixture } = await setup(() => of(envelope(user({ phoneNumber: '+49 170 000000' }))));

    const rows = [...fixture.nativeElement.querySelectorAll('dl > div')].map(
      (row: HTMLElement) =>
        `${row.querySelector('dt')?.textContent?.trim()}: ${row.querySelector('dd')?.textContent?.trim()}`,
    );
    expect(rows.slice(0, 7)).toEqual([
      'Name: Ada Lovelace',
      'Email: ada@flux.local',
      'Email verified: Yes',
      'Phone: +49 170 000000',
      'Roles: Customer',
      'Language: en',
      'Time zone: UTC',
    ]);
    expect(rows).toHaveLength(8);
    expect(rows[7]?.startsWith('Member since: ')).toBe(true);
    expect((rows[7] ?? '').length).toBeGreaterThan('Member since: '.length);
  });

  it('renders the not-provided note for absent optional data', async () => {
    const { fixture } = await setup();
    const rows = [...fixture.nativeElement.querySelectorAll('dl > div')].map((row: HTMLElement) =>
      row.querySelector('dd')?.textContent?.trim(),
    );
    expect(rows).toContain('Not provided');
  });

  it('exposes no edit surface (no forms, inputs, or action buttons)', async () => {
    const { fixture } = await setup();
    const loaded = fixture.nativeElement.querySelector('dl');
    expect(loaded).not.toBeNull();
    expect(loaded.querySelector('form, input, select, textarea, button')).toBeNull();
  });

  it('sets the localized document title', async () => {
    const { fixture } = await setup();
    expect(TestBed.inject(Title).getTitle()).toBe('Profile');
    expect(fixture).toBeTruthy();
  });

  it('localizes copy with the active culture', async () => {
    const { fixture } = await setup();
    TestBed.inject(CultureService).setCulture('fr');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(textOf(fixture, 'h1')).toBe('Profil');
    expect(TestBed.inject(Title).getTitle()).toBe('Profil');

    TestBed.inject(CultureService).setCulture('en');
  });
});

describe('ProfilePage errors', () => {
  it('renders the failure with retry and recovers on retry', async () => {
    const identity = { getCurrentUser: vi.fn() };
    vi.mocked(identity.getCurrentUser).mockReturnValueOnce(
      throwError(() => new ApiError({ status: 401, message: 'Anonymous.' })),
    );
    vi.mocked(identity.getCurrentUser).mockReturnValue(of(envelope(user())));

    await TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        provideRouter([]),
        CultureService,
        AccountState,
        { provide: IdentityApiService, useValue: identity },
        { provide: AuthService, useValue: { updateCurrentUser: vi.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProfilePage);
    TestBed.inject(CultureService).setCulture('en');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('flux-error-state')).not.toBeNull();
    expect(textOf(fixture, 'flux-error-state')).toContain('Profile unavailable');

    const retry = fixture.nativeElement.querySelector(
      'flux-error-state button',
    ) as HTMLButtonElement;
    expect(retry).not.toBeNull();
    retry.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(identity.getCurrentUser).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('flux-error-state')).toBeNull();
    expect(fixture.nativeElement.querySelector('dl')).not.toBeNull();
  });
});

describe('ProfilePage focus management', () => {
  it('moves focus to the heading on entry', async () => {
    const { fixture } = await setup();

    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('h1'));
  });

  it('moves focus to the error banner once per failure', async () => {
    const identity = { getCurrentUser: vi.fn() };
    vi.mocked(identity.getCurrentUser).mockReturnValue(
      throwError(() => new ApiError({ status: 500, message: 'Server fault.' })),
    );

    await TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        provideRouter([]),
        CultureService,
        AccountState,
        { provide: IdentityApiService, useValue: identity },
        { provide: AuthService, useValue: { updateCurrentUser: vi.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProfilePage);
    TestBed.inject(CultureService).setCulture('en');
    fixture.detectChanges();
    await fixture.whenStable();

    const banner = fixture.nativeElement.querySelector('[data-error-focus]');
    expect(banner).not.toBeNull();
    expect(document.activeElement).toBe(banner);

    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(banner);
  });
});
