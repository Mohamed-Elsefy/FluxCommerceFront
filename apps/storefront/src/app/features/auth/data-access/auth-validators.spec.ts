import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import {
  AUTH_EMAIL_MAX_LENGTH,
  AUTH_NAME_MAX_LENGTH,
  AUTH_PASSWORD_MAX_LENGTH,
  AUTH_PASSWORD_MIN_LENGTH,
  authEmailValidators,
  authNameValidators,
  loginPasswordValidators,
  nonBlankValidator,
  passwordComplexityValidator,
  registerPasswordValidators,
} from './auth-validators';

function run(value: unknown, validators: ReturnType<typeof authEmailValidators>): object | null {
  const control = new FormControl(value, validators);
  control.updateValueAndValidity();
  return control.errors;
}

describe('auth validators', () => {
  it('rejects blank, malformed, and over-long emails', () => {
    expect(run('', authEmailValidators()))?.toMatchObject({ required: true });
    expect(run('not-an-email', authEmailValidators()))?.toMatchObject({ email: true });
    expect(run(`${'a'.repeat(AUTH_EMAIL_MAX_LENGTH)}@x.io`, authEmailValidators()))?.toMatchObject({
      maxlength: expect.anything(),
    });
    expect(run('ada@flux.local', authEmailValidators())).toBeNull();
  });

  it('requires a login password without enforcing policy', () => {
    expect(run('', loginPasswordValidators()))?.toMatchObject({ required: true });
    expect(run('weak', loginPasswordValidators())).toBeNull();
    expect(run('x'.repeat(AUTH_PASSWORD_MAX_LENGTH + 1), loginPasswordValidators()))?.toMatchObject(
      { maxlength: expect.anything() },
    );
  });

  it('enforces registration password length and complexity', () => {
    expect(run('', registerPasswordValidators()))?.toMatchObject({ required: true });
    expect(run('Short1!', registerPasswordValidators()))?.toMatchObject({
      minlength: expect.anything(),
    });
    expect(run('alllowercase1!', registerPasswordValidators()))?.toMatchObject({
      passwordComplexity: true,
    });
    expect(run('ALLUPPERCASE1!', registerPasswordValidators()))?.toMatchObject({
      passwordComplexity: true,
    });
    expect(run('NoDigitsHere!', registerPasswordValidators()))?.toMatchObject({
      passwordComplexity: true,
    });
    expect(run('NoSpecial123', registerPasswordValidators()))?.toMatchObject({
      passwordComplexity: true,
    });
    expect(run('Valid123!', registerPasswordValidators())).toBeNull();
  });

  it('rejects blank names and enforces the length budget', () => {
    expect(run('', authNameValidators()))?.toMatchObject({ required: true });
    expect(run('   ', authNameValidators()))?.toMatchObject({ nonBlank: true });
    expect(run('x'.repeat(AUTH_NAME_MAX_LENGTH + 1), authNameValidators()))?.toMatchObject({
      maxlength: expect.anything(),
    });
    expect(run('Ada', authNameValidators())).toBeNull();
  });

  it('nonBlankValidator ignores empty values (required owns them)', () => {
    expect(nonBlankValidator()(new FormControl(''))).toBeNull();
    expect(nonBlankValidator()(new FormControl(null))).toBeNull();
  });

  it('passwordComplexityValidator ignores empty values (required owns them)', () => {
    expect(passwordComplexityValidator()(new FormControl(''))).toBeNull();
  });
});
