import { FormBuilder } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import type { CustomerProfile } from './orders.models';
import {
  PROFILE_AVATAR_MAX_LENGTH,
  PROFILE_LANGUAGE_MAX_LENGTH,
  PROFILE_NAME_MAX_LENGTH,
  PROFILE_PHONE_MAX_LENGTH,
  PROFILE_SERVER_ERROR_KEY,
  PROFILE_TIMEZONE_MAX_LENGTH,
  applyProfileServerErrors,
  clearProfileServerErrors,
  createProfileFormGroup,
  profileDraftOf,
  toUpdateProfileRequest,
} from './profile-edit.models';

const PROFILE: CustomerProfile = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'ada@flux.local',
  roles: ['Customer'],
  isEmailVerified: true,
  registeredAtUtc: '2026-09-04T10:00:00Z',
  firstName: 'Ada',
  lastName: 'Lovelace',
  displayName: 'Ada Lovelace',
  phoneNumber: '+49 170 000000',
  isPhoneVerified: false,
  avatarUrl: null,
  preferredLanguage: 'en',
  timeZone: 'UTC',
  status: 1,
  permissions: [],
};

describe('profile draft projection', () => {
  it('prefills strings and maps absent values to empty', () => {
    expect(profileDraftOf(PROFILE)).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      phoneNumber: '+49 170 000000',
      avatarUrl: '',
      preferredLanguage: 'en',
      timeZone: 'UTC',
    });
  });

  it('projects the draft onto the wire body verbatim', () => {
    expect(
      toUpdateProfileRequest({
        firstName: 'Ada',
        lastName: 'Lovelace',
        phoneNumber: '',
        avatarUrl: '',
        preferredLanguage: 'en',
        timeZone: 'UTC',
      }),
    ).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      phoneNumber: '',
      avatarUrl: '',
      preferredLanguage: 'en',
      timeZone: 'UTC',
    });
  });
});

describe('profile form construction', () => {
  it('builds six string controls with contract-mirroring validators', () => {
    const form = createProfileFormGroup(new FormBuilder(), profileDraftOf(PROFILE));

    expect(Object.keys(form.controls).sort()).toEqual(
      ['avatarUrl', 'firstName', 'lastName', 'phoneNumber', 'preferredLanguage', 'timeZone'].sort(),
    );
    expect(form.controls.firstName.value).toBe('Ada');
    expect(form.controls.phoneNumber.value).toBe('+49 170 000000');

    form.controls.firstName.setValue('');
    expect(form.controls.firstName.invalid).toBe(true);

    form.controls.firstName.setValue('   ');
    expect(form.controls.firstName.invalid).toBe(true);

    form.controls.firstName.setValue('x'.repeat(PROFILE_NAME_MAX_LENGTH + 1));
    expect(form.controls.firstName.invalid).toBe(true);

    form.controls.phoneNumber.setValue('x'.repeat(PROFILE_PHONE_MAX_LENGTH + 1));
    expect(form.controls.phoneNumber.invalid).toBe(true);

    form.controls.avatarUrl.setValue('x'.repeat(PROFILE_AVATAR_MAX_LENGTH + 1));
    expect(form.controls.avatarUrl.invalid).toBe(true);

    form.controls.preferredLanguage.setValue('x'.repeat(PROFILE_LANGUAGE_MAX_LENGTH + 1));
    expect(form.controls.preferredLanguage.invalid).toBe(true);

    form.controls.timeZone.setValue('x'.repeat(PROFILE_TIMEZONE_MAX_LENGTH + 1));
    expect(form.controls.timeZone.invalid).toBe(true);
  });

  it('accepts a fully valid draft', () => {
    const form = createProfileFormGroup(new FormBuilder(), profileDraftOf(PROFILE));

    expect(form.valid).toBe(true);
  });
});

describe('profile server field errors', () => {
  it('merges backend messages under the server key, matched case-insensitively', () => {
    const form = createProfileFormGroup(new FormBuilder(), profileDraftOf(PROFILE));

    applyProfileServerErrors(form, { FirstName: ['Too short.'], UNKNOWNFIELD: ['No control.'] });

    expect(form.controls.firstName.errors?.[PROFILE_SERVER_ERROR_KEY]).toEqual(['Too short.']);
    expect(form.controls.lastName.errors).toBeNull();
  });

  it('clears server errors while preserving client-side errors', () => {
    const form = createProfileFormGroup(new FormBuilder(), profileDraftOf(PROFILE));
    form.controls.firstName.setValue('');
    applyProfileServerErrors(form, { firstName: ['Too short.'] });
    expect(form.controls.firstName.errors?.[PROFILE_SERVER_ERROR_KEY]).toEqual(['Too short.']);

    clearProfileServerErrors(form);

    expect(form.controls.firstName.errors?.[PROFILE_SERVER_ERROR_KEY]).toBeUndefined();
    expect(form.controls.firstName.errors?.['required']).toBeTruthy();
  });

  it('ignores undefined maps and empty message lists', () => {
    const form = createProfileFormGroup(new FormBuilder(), profileDraftOf(PROFILE));

    applyProfileServerErrors(form, undefined);
    applyProfileServerErrors(form, { firstName: [] });

    expect(form.controls.firstName.errors).toBeNull();
  });
});
