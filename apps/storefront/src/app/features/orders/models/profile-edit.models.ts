/**
 * Storefront profile-edit models for Supplement S1, Step S1.4 — Profile
 * Editing.
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §1.18
 * (`PUT /auth/profile` → `ApiResponse<UserResponse>`) and
 * `docs/frontend-contract/DTO_REFERENCE.md` §1 (`UpdateProfileRequest`).
 * The canonical wire mirror stays in `@flux/models` — this module owns
 * the feature-local draft shape, the typed-form factory, the draft →
 * request projection, and the server field-error helpers. Pure types +
 * pure functions (form factory included): no HTTP, no storage — SSR-safe.
 *
 * Nullable semantics (`UpdateProfileRequest`, all fields nullable):
 * `null` keeps the current value, empty clears optional fields
 * (`phoneNumber`, `avatarUrl`). The form always yields strings, so this
 * slice sends a full snapshot on every save: unchanged values round-trip
 * verbatim (idempotent PUT), empty optional strings clear, and required
 * names can never submit blank (client validators mirror the backend).
 * The backend remains authoritative — client rules are pre-checks only.
 */

import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import type { ValidationErrors } from '@angular/forms';
import type { AbstractControl, ValidatorFn } from '@angular/forms';
import type { UpdateProfileRequest } from '@flux/models';
import type { CustomerProfile } from './orders.models';

/** Backend name limit (mirrors auth `NameRules`, max 100). */
export const PROFILE_NAME_MAX_LENGTH = 100;

/** Backend phone limit (`UpdateProfileRequest`: phone ≤ 30). */
export const PROFILE_PHONE_MAX_LENGTH = 30;

/** Backend avatar limit (`UpdateProfileRequest`: avatar ≤ 2048). */
export const PROFILE_AVATAR_MAX_LENGTH = 2048;

/** Backend language limit (`UpdateProfileRequest`: language ≤ 10). */
export const PROFILE_LANGUAGE_MAX_LENGTH = 10;

/** Backend time-zone limit (`UpdateProfileRequest`: timezone ≤ 64). */
export const PROFILE_TIMEZONE_MAX_LENGTH = 64;

/**
 * Editable profile draft: one string per `UpdateProfileRequest` field.
 * Absent backend values prefill as `''` (see `profileDraftOf`).
 */
export interface ProfileDraft {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  avatarUrl: string;
  preferredLanguage: string;
  timeZone: string;
}

/**
 * Prefills an editable draft from the settled backend profile
 * (`null`/`undefined` → `''`). Pure — throws nothing.
 */
export function profileDraftOf(profile: CustomerProfile): ProfileDraft {
  return {
    firstName: profile.firstName ?? '',
    lastName: profile.lastName ?? '',
    phoneNumber: profile.phoneNumber ?? '',
    avatarUrl: profile.avatarUrl ?? '',
    preferredLanguage: profile.preferredLanguage ?? '',
    timeZone: profile.timeZone ?? '',
  };
}

/**
 * Projects a validated draft onto the wire body. Strings travel as-is:
 * empty optional `phoneNumber`/`avatarUrl` clear server-side per the
 * nullable contract; names are non-blank by construction (the form
 * blocks submit otherwise). Pure — throws nothing.
 */
export function toUpdateProfileRequest(draft: ProfileDraft): UpdateProfileRequest {
  return {
    firstName: draft.firstName,
    lastName: draft.lastName,
    phoneNumber: draft.phoneNumber,
    avatarUrl: draft.avatarUrl,
    preferredLanguage: draft.preferredLanguage,
    timeZone: draft.timeZone,
  };
}

/**
 * Rejects whitespace-only values (the backend trims; `Validators.required`
 * alone would accept `"   "`).
 */
export function nonBlankValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (typeof value !== 'string' || value.length === 0) {
      return null;
    }
    return value.trim().length === 0 ? { nonBlank: true } : null;
  };
}

/** First/last name validators: required + non-blank + backend max. */
export function profileNameValidators(): ValidatorFn[] {
  return [Validators.required, nonBlankValidator(), Validators.maxLength(PROFILE_NAME_MAX_LENGTH)];
}

/**
 * Typed controls of the profile-edit form (all raw strings, `''` = empty).
 */
export interface ProfileFormControls {
  readonly firstName: FormControl<string>;
  readonly lastName: FormControl<string>;
  readonly phoneNumber: FormControl<string>;
  readonly avatarUrl: FormControl<string>;
  readonly preferredLanguage: FormControl<string>;
  readonly timeZone: FormControl<string>;
}

/** Typed profile-edit form group. */
export type ProfileFormGroup = FormGroup<ProfileFormControls>;

/**
 * Builds the typed profile-edit `FormGroup` from a draft. All controls
 * hold strings; optional fields carry no `required` (empty clears).
 * Pure construction — performs no HTTP and triggers nothing.
 */
export function createProfileFormGroup(
  formBuilder: FormBuilder,
  draft: ProfileDraft,
): ProfileFormGroup {
  return formBuilder.nonNullable.group({
    firstName: [draft.firstName, profileNameValidators()],
    lastName: [draft.lastName, profileNameValidators()],
    phoneNumber: [draft.phoneNumber, Validators.maxLength(PROFILE_PHONE_MAX_LENGTH)],
    avatarUrl: [draft.avatarUrl, Validators.maxLength(PROFILE_AVATAR_MAX_LENGTH)],
    preferredLanguage: [draft.preferredLanguage, Validators.maxLength(PROFILE_LANGUAGE_MAX_LENGTH)],
    timeZone: [draft.timeZone, Validators.maxLength(PROFILE_TIMEZONE_MAX_LENGTH)],
  });
}

/** Error key holding backend field messages on a control. */
export const PROFILE_SERVER_ERROR_KEY = 'server';

/**
 * Merges a backend field-error map onto matching controls (matched
 * case-insensitively: `FirstName` → `firstName`). Unknown fields are
 * ignored — their messages stay visible in the form-level alert. Existing
 * client-side errors are preserved. Pure DOM-free helper — throws nothing.
 */
export function applyProfileServerErrors(
  form: FormGroup,
  errors: Record<string, string[]> | undefined,
): void {
  if (errors === undefined) {
    return;
  }
  const controlNames = Object.keys(form.controls);
  for (const [field, messages] of Object.entries(errors)) {
    const match = controlNames.find((name) => name.toLowerCase() === field.toLowerCase());
    if (match === undefined || messages.length === 0) {
      continue;
    }
    const control = form.controls[match];
    const current: ValidationErrors | null = control.errors;
    control.setErrors({ ...(current ?? {}), [PROFILE_SERVER_ERROR_KEY]: messages });
  }
}

/**
 * Removes previously applied server errors, preserving client-side
 * errors. Pure DOM-free helper — throws nothing.
 */
export function clearProfileServerErrors(form: FormGroup): void {
  for (const control of Object.values(form.controls)) {
    const current: ValidationErrors | null = control.errors;
    if (current === null || !(PROFILE_SERVER_ERROR_KEY in current)) {
      continue;
    }
    const { [PROFILE_SERVER_ERROR_KEY]: _removed, ...rest } = current;
    control.setErrors(Object.keys(rest).length === 0 ? null : rest);
  }
}
