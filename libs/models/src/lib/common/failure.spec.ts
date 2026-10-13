import { describe, expect, it } from 'vitest';
import {
  hasFieldErrors,
  isAccessDeniedFailure,
  isAuthFailure,
  isConflictFailure,
  isFormPreservingFailure,
  isNotFoundFailure,
  isTransportFailure,
  isValidationFailure,
} from './failure';

describe('shared failure classifiers (Refactoring Phase A)', () => {
  it('classifies validation failures status-first', () => {
    expect(isValidationFailure({ status: 400 })).toBe(true);
    expect(isValidationFailure({ status: 409 })).toBe(false);
    expect(isValidationFailure(null)).toBe(false);
    expect(isValidationFailure(undefined)).toBe(false);
  });

  it('detects field-error maps on the 400 shape only', () => {
    expect(hasFieldErrors({ status: 400, validationErrors: { quantity: ['Required'] } })).toBe(
      true,
    );
    expect(hasFieldErrors({ status: 400, validationErrors: {} })).toBe(false);
    expect(hasFieldErrors({ status: 400 })).toBe(false);
    expect(hasFieldErrors({ status: 409, validationErrors: { x: ['y'] } })).toBe(false);
    expect(hasFieldErrors(null)).toBe(false);
  });

  it('classifies auth, denial, missing, and conflict failures', () => {
    expect(isAuthFailure({ status: 401 })).toBe(true);
    expect(isAuthFailure({ status: 403 })).toBe(false);
    expect(isAccessDeniedFailure({ status: 403 })).toBe(true);
    expect(isAccessDeniedFailure({ status: 404 })).toBe(false);
    expect(isNotFoundFailure({ status: 404 })).toBe(true);
    expect(isNotFoundFailure(null)).toBe(false);
    expect(isConflictFailure({ status: 409 })).toBe(true);
    expect(isConflictFailure({ status: 400 })).toBe(false);
  });

  it('distinguishes transport failures from form-preserving 4xx', () => {
    expect(isTransportFailure({ status: 0 })).toBe(true);
    expect(isTransportFailure({ status: 500 })).toBe(false);
    expect(isFormPreservingFailure({ status: 400 })).toBe(true);
    expect(isFormPreservingFailure({ status: 409 })).toBe(true);
    expect(isFormPreservingFailure({ status: 404 })).toBe(true);
    expect(isFormPreservingFailure({ status: 0 })).toBe(false);
    expect(isFormPreservingFailure({ status: 500 })).toBe(false);
    expect(isFormPreservingFailure(null)).toBe(false);
    expect(isFormPreservingFailure(undefined)).toBe(false);
  });
});
