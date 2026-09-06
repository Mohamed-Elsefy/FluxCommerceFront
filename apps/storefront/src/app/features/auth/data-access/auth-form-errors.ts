/**
 * Server-side validation error mapping for auth forms (Sub-Phase 2.4).
 *
 * Backend `400 ValidationProblemDetail` bodies carry `errors{field: [msg]}`
 * keyed by C#/DTO property names (`Email`, `Password`, `FirstName`, ...
 * — see `docs/frontend-contract/ERROR_CATALOG.md` §0), while reactive form
 * controls use wire `camelCase` names. These helpers bridge the two without
 * touching client-side errors: server messages merge under a dedicated
 * `server` key and are cleared on the next submit.
 */

import { FormGroup, ValidationErrors } from '@angular/forms';

/** Error key holding backend field messages on a control. */
export const SERVER_ERROR_KEY = 'server';

/**
 * Merges a backend field-error map onto matching controls (matched
 * case-insensitively: `Email` → `email`). Unknown fields are ignored —
 * their messages stay visible in the form-level alert. Existing
 * client-side errors are preserved.
 */
export function applyServerValidationErrors(
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
    control.setErrors({ ...(current ?? {}), [SERVER_ERROR_KEY]: messages });
  }
}

/** Removes previously applied server errors, preserving client-side errors. */
export function clearServerValidationErrors(form: FormGroup): void {
  for (const control of Object.values(form.controls)) {
    const current: ValidationErrors | null = control.errors;
    if (current === null || !(SERVER_ERROR_KEY in current)) {
      continue;
    }
    const { [SERVER_ERROR_KEY]: _removed, ...rest } = current;
    control.setErrors(Object.keys(rest).length === 0 ? null : rest);
  }
}
