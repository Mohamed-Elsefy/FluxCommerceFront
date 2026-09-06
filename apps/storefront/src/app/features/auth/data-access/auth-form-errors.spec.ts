import { FormControl, FormGroup, Validators } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import {
  SERVER_ERROR_KEY,
  applyServerValidationErrors,
  clearServerValidationErrors,
} from './auth-form-errors';

function form(): FormGroup<{ email: FormControl<string>; password: FormControl<string> }> {
  return new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
}

describe('auth server validation errors', () => {
  it('maps C# property names onto camelCase controls and preserves client errors', () => {
    const group = form();
    group.controls.email.setErrors({ required: true });

    applyServerValidationErrors(group, {
      Email: ['Email is already taken.'],
      UnknownField: ['Something else failed.'],
      password: [],
    });

    expect(group.controls.email.errors).toMatchObject({
      required: true,
      [SERVER_ERROR_KEY]: ['Email is already taken.'],
    });
    expect(group.controls.password.errors).toEqual({ required: true });
  });

  it('ignores undefined maps and empty message lists', () => {
    const group = form();

    expect(() => applyServerValidationErrors(group, undefined)).not.toThrow();
    applyServerValidationErrors(group, { email: [] });
    expect(group.controls.email.errors).toEqual({ required: true });
  });

  it('clears only server errors, keeping client errors intact', () => {
    const group = form();
    group.controls.email.setErrors({ required: true, [SERVER_ERROR_KEY]: ['Taken.'] });
    group.controls.password.setErrors({ [SERVER_ERROR_KEY]: ['Weak.'] });

    clearServerValidationErrors(group);

    expect(group.controls.email.errors).toEqual({ required: true });
    expect(group.controls.password.errors).toBeNull();
  });
});
