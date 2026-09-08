/**
 * Typed-form validators for the Sub-Phase 2.4 authentication vertical slice.
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §1.1/§1.3
 * (Fluent validation via `*CommandValidator`, `EmailRules`,
 * `PasswordPolicy`, `NameRules`) and `docs/frontend-contract/AUTH_FLOW.md`
 * §6. Client rules mirror the backend contract so invalid input is rejected
 * locally; the backend remains authoritative and its `400` field errors are
 * applied separately (see `./auth-form-errors`).
 *
 * Backend rules mirrored here:
 * - Email: required, format, max 254, trimmed + lower-cased server-side.
 * - Password (register/reset/change): 8..128 chars with upper + lower +
 *   digit + special from `!@#$%^&*()-_=+[]{};:'",.<>/?\|` + backtick + `~`.
 *   Login enforces required-only (never lock out logins on policy drift).
 * - First/last name: required, non-blank, trimmed, max 100.
 *
 * Copy is minimal English — localization arrives in Phase 4.
 */

import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

/** Backend email limit (`EmailRules`, max 254). */
export const AUTH_EMAIL_MAX_LENGTH = 254;

/** Backend name limit (`NameRules`, max 100 displayName budget). */
export const AUTH_NAME_MAX_LENGTH = 100;

/** Backend password bounds (`PasswordPolicy`). */
export const AUTH_PASSWORD_MIN_LENGTH = 8;
export const AUTH_PASSWORD_MAX_LENGTH = 128;

/** Backend special-character set (`PasswordPolicy`, verbatim). */
const PASSWORD_SPECIAL_CHARACTERS = '!@#$%^&*()-_=+[]{};:\'",.<>/?\\|`~';

/** Email control validators shared by login and registration. */
export function authEmailValidators(): ValidatorFn[] {
  return [Validators.required, Validators.email, Validators.maxLength(AUTH_EMAIL_MAX_LENGTH)];
}

/** Login password validators: required only (see header). */
export function loginPasswordValidators(): ValidatorFn[] {
  return [Validators.required, Validators.maxLength(AUTH_PASSWORD_MAX_LENGTH)];
}

/** Registration password validators: required + length + complexity. */
export function registerPasswordValidators(): ValidatorFn[] {
  return [
    Validators.required,
    Validators.minLength(AUTH_PASSWORD_MIN_LENGTH),
    Validators.maxLength(AUTH_PASSWORD_MAX_LENGTH),
    passwordComplexityValidator(),
  ];
}

/** Name control validators shared by first/last name. */
export function authNameValidators(): ValidatorFn[] {
  return [Validators.required, nonBlankValidator(), Validators.maxLength(AUTH_NAME_MAX_LENGTH)];
}

/**
 * Rejects whitespace-only values (backend trims; `Validators.required`
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

/**
 * Cross-field equality for password confirmation (reset/change UX — the
 * backend `ResetPasswordRequest` itself carries no confirmation field, so
 * this never travels over the wire; `ChangePasswordRequest.confirmPassword`
 * is then guaranteed to match by construction).
 */
export function matchingPasswordsValidator(passwordKey: string, confirmKey: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get(passwordKey)?.value;
    const confirm = group.get(confirmKey)?.value;
    if (typeof password !== 'string' || typeof confirm !== 'string' || confirm.length === 0) {
      return null;
    }
    return password === confirm ? null : { passwordMismatch: true };
  };
}
/**
 * Backend `PasswordPolicy` complexity: at least one upper-case, one
 * lower-case, one digit, and one special character. Length is enforced by
 * `minLength`/`maxLength` alongside this validator.
 */
export function passwordComplexityValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (typeof value !== 'string' || value.length === 0) {
      return null;
    }
    const hasUpper = /[A-Z]/.test(value);
    const hasLower = /[a-z]/.test(value);
    const hasDigit = /[0-9]/.test(value);
    const hasSpecial = [...value].some((character) =>
      PASSWORD_SPECIAL_CHARACTERS.includes(character),
    );
    return hasUpper && hasLower && hasDigit && hasSpecial ? null : { passwordComplexity: true };
  };
}
