/**
 * State tests for the Sub-Phase 10.2 `AccountState`.
 *
 * Covers the profile resource lifecycle only (idle → loading →
 * success | error, session re-sync, load dedupe, forced retry): the
 * `IdentityApiService` transport is stubbed at its typed seam and the
 * central `AuthService` is stubbed to its `updateCurrentUser` seam, so
 * these tests own the feature logic — envelope unwrapping, contract-
 * breach handling, and selector behavior — without HTTP or session
 * machinery.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import { ApiError, IdentityApiService, type ApiResponseWithData } from '@flux/api';
import { AuthService } from '@flux/auth';
import type { UserResponse } from '@flux/models';
import { AccountState } from './account-state';

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
    permissions: [],
    ...overrides,
  };
}

function envelope(data: UserResponse | null | undefined): ApiResponseWithData<UserResponse> {
  return { isSuccess: true, data: data ?? null };
}

interface Setup {
  state: AccountState;
  identity: { getCurrentUser: ReturnType<typeof vi.fn>; updateProfile: ReturnType<typeof vi.fn> };
  auth: { updateCurrentUser: ReturnType<typeof vi.fn> };
}

function setup(): Setup {
  const identity = {
    getCurrentUser: vi.fn(() => of(envelope(user()))),
    updateProfile: vi.fn(() => of(envelope(user()))),
  };
  const auth = { updateCurrentUser: vi.fn() };

  TestBed.configureTestingModule({
    providers: [
      AccountState,
      { provide: IdentityApiService, useValue: identity },
      { provide: AuthService, useValue: auth },
    ],
  });
  return { state: TestBed.inject(AccountState), identity, auth };
}

describe('AccountState initial resource', () => {
  it('starts idle with no profile and no error', () => {
    const { state, identity } = setup();

    expect(state.status()).toBe('idle');
    expect(state.profile()).toBeNull();
    expect(state.error()).toBeNull();
    expect(state.isLoading()).toBe(false);
    expect(state.isSuccess()).toBe(false);
    expect(state.isError()).toBe(false);
    expect(identity.getCurrentUser).not.toHaveBeenCalled();
  });
});

describe('AccountState loadProfile', () => {
  it('loads the live backend profile into the success slot', () => {
    const { state, identity } = setup();
    state.loadProfile();

    expect(identity.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(state.status()).toBe('success');
    expect(state.profile()).toEqual(user());
    expect(state.error()).toBeNull();
    expect(state.isSuccess()).toBe(true);
  });

  it('re-syncs the central session user through the shared mapper', () => {
    const { state, auth } = setup();
    state.loadProfile();

    expect(auth.updateCurrentUser).toHaveBeenCalledTimes(1);
    expect(auth.updateCurrentUser).toHaveBeenCalledWith({
      id: USER_ID,
      email: 'ada@flux.local',
      displayName: 'Ada Lovelace',
      roles: ['Customer'],
      permissions: [],
      isEmailVerified: true,
      avatarUrl: null,
    });
  });

  it('treats a 200 without data as failure (never a rendered profile)', () => {
    const { state, identity, auth } = setup();
    vi.mocked(identity.getCurrentUser).mockReturnValueOnce(of(envelope(null)));
    state.loadProfile();

    expect(state.status()).toBe('error');
    expect(state.profile()).toBeNull();
    expect(state.error()).not.toBeNull();
    expect(state.isError()).toBe(true);
    expect(auth.updateCurrentUser).not.toHaveBeenCalled();
  });

  it('lands backend failures in the error slot untouched', () => {
    const { state, identity, auth } = setup();
    const failure = new ApiError({ status: 401, message: 'Anonymous.' });
    vi.mocked(identity.getCurrentUser).mockReturnValueOnce(throwError(() => failure));
    state.loadProfile();

    expect(state.status()).toBe('error');
    expect(state.profile()).toBeNull();
    expect(state.error()).toBe(failure);
    expect(auth.updateCurrentUser).not.toHaveBeenCalled();
  });

  it('dedupes concurrent loads to a single request', () => {
    const { state, identity } = setup();
    const pending = new Subject<ApiResponseWithData<UserResponse>>();
    vi.mocked(identity.getCurrentUser).mockReturnValue(pending.asObservable());

    state.loadProfile();
    expect(state.status()).toBe('loading');
    state.loadProfile();
    state.loadProfile();

    expect(identity.getCurrentUser).toHaveBeenCalledTimes(1);

    pending.next(envelope(user()));
    pending.complete();
    expect(state.status()).toBe('success');
  });

  it('does not reload after success without force', () => {
    const { state, identity } = setup();
    state.loadProfile();
    state.loadProfile();

    expect(identity.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(state.status()).toBe('success');
  });

  it('reloads after success when forced', () => {
    const { state, identity } = setup();
    state.loadProfile();
    state.loadProfile({ force: true });

    expect(identity.getCurrentUser).toHaveBeenCalledTimes(2);
    expect(state.status()).toBe('success');
  });

  it('retries after errors with a fresh request', () => {
    const { state, identity } = setup();
    vi.mocked(identity.getCurrentUser).mockReturnValueOnce(
      throwError(() => new ApiError({ status: 0, message: 'Unreachable.' })),
    );
    state.loadProfile();
    expect(state.status()).toBe('error');

    state.retry();
    expect(identity.getCurrentUser).toHaveBeenCalledTimes(2);
    expect(state.status()).toBe('success');
    expect(state.profile()).toEqual(user());
  });
});

describe('AccountState saveProfile (Supplement S1)', () => {
  const BODY = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    phoneNumber: '+49 170 000000',
    avatarUrl: '',
    preferredLanguage: 'en',
    timeZone: 'UTC',
  };

  it('starts idle with no save outcome', () => {
    const { state, identity } = setup();

    expect(state.saveStatus()).toBe('idle');
    expect(state.saveError()).toBeNull();
    expect(state.isSaving()).toBe(false);
    expect(state.isSaveSuccess()).toBe(false);
    expect(identity.updateProfile).not.toHaveBeenCalled();
  });

  it('submits the draft and refreshes the profile plus the session', () => {
    const { state, identity, auth } = setup();
    const edited = user({ phoneNumber: '+49 170 000000' });
    vi.mocked(identity.updateProfile).mockReturnValue(of(envelope(edited)));

    state.saveProfile(BODY);

    expect(identity.updateProfile).toHaveBeenCalledTimes(1);
    expect(identity.updateProfile).toHaveBeenCalledWith(BODY, {});
    expect(state.saveStatus()).toBe('success');
    expect(state.isSaveSuccess()).toBe(true);
    expect(state.saveError()).toBeNull();
    expect(state.profile()).toEqual(edited);
    expect(auth.updateCurrentUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: USER_ID, email: 'ada@flux.local' }),
    );
  });

  it('locks duplicate submits while saving', () => {
    const { state, identity } = setup();
    const pending = new Subject<ApiResponseWithData<UserResponse>>();
    vi.mocked(identity.updateProfile).mockReturnValue(pending.asObservable());

    state.saveProfile(BODY);
    expect(state.isSaving()).toBe(true);
    state.saveProfile(BODY);
    state.saveProfile(BODY);

    expect(identity.updateProfile).toHaveBeenCalledTimes(1);

    pending.next(envelope(user()));
    pending.complete();
    expect(state.saveStatus()).toBe('success');
  });

  it('lands 400 field failures in the save slot without touching the profile', () => {
    const { state, identity, auth } = setup();
    state.loadProfile();
    const failure = new ApiError({
      status: 400,
      message: 'Invalid.',
      validationErrors: { FirstName: ['Too short.'] },
    });
    vi.mocked(identity.updateProfile).mockReturnValueOnce(throwError(() => failure));

    state.saveProfile({ ...BODY, firstName: '' });

    expect(state.saveStatus()).toBe('error');
    expect(state.saveError()).toBe(failure);
    expect(state.saveError()?.validationErrors).toEqual({ FirstName: ['Too short.'] });
    expect(state.profile()).toEqual(user());
    expect(auth.updateCurrentUser).toHaveBeenCalledTimes(1);
  });

  it('lands 404 failures in the save slot (deleted-between-login)', () => {
    const { state, identity } = setup();
    const failure = new ApiError({ status: 404, message: 'Gone.' });
    vi.mocked(identity.updateProfile).mockReturnValueOnce(throwError(() => failure));

    state.saveProfile(BODY);

    expect(state.saveStatus()).toBe('error');
    expect(state.saveError()).toBe(failure);
  });

  it('clears the save slot on reset', () => {
    const { state, identity } = setup();
    const failure = new ApiError({ status: 500, message: 'Server fault.' });
    vi.mocked(identity.updateProfile).mockReturnValueOnce(throwError(() => failure));
    state.saveProfile(BODY);
    expect(state.saveStatus()).toBe('error');

    state.resetSave();

    expect(state.saveStatus()).toBe('idle');
    expect(state.saveError()).toBeNull();
    expect(state.isSaveSuccess()).toBe(false);
    expect(identity.updateProfile).toHaveBeenCalledTimes(1);
  });
});
