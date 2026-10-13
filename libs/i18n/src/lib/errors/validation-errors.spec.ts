/**
 * Localized validation tests for Sub-Phase 4.6.
 *
 * Covers resolution of Angular `ValidationErrors` to localized base
 * messages across all five supported cultures, unknown-key fallback to the
 * generic message, stable multi-error priority, and graceful handling of
 * empty or malformed inputs.
 */

import { describe, expect, it } from 'vitest';
import type { Culture } from '../culture/culture';
import { resolveValidationMessage } from './validation-errors';

describe('resolveValidationMessage', () => {
  it('returns null when there is nothing to report', () => {
    expect(resolveValidationMessage(null, 'en')).toBeNull();
    expect(resolveValidationMessage(undefined, 'en')).toBeNull();
    expect(resolveValidationMessage({}, 'ar')).toBeNull();
  });

  it('localizes the required message in every supported culture', () => {
    expect(resolveValidationMessage({ required: true }, 'en')).toBe('This field is required.');
    expect(resolveValidationMessage({ required: true }, 'fr')).toBe('Ce champ est obligatoire.');
    expect(resolveValidationMessage({ required: true }, 'de')).toBe(
      'Dieses Feld ist erforderlich.',
    );
    expect(resolveValidationMessage({ required: true }, 'es')).toBe('Este campo es obligatorio.');
    expect(resolveValidationMessage({ required: true }, 'ar')).toBe('هذا الحقل مطلوب.');
  });

  it('interpolates length and range constraints from Angular payloads', () => {
    expect(
      resolveValidationMessage({ minlength: { requiredLength: 8, actualLength: 3 } }, 'en'),
    ).toBe('Enter at least 8 characters.');
    expect(
      resolveValidationMessage({ maxlength: { requiredLength: 10, actualLength: 12 } }, 'fr'),
    ).toBe('Saisissez au maximum 10 caractères.');
    expect(resolveValidationMessage({ min: { min: 5, actual: 2 } }, 'de')).toBe(
      'Geben Sie einen Wert von mindestens 5 ein.',
    );
    expect(resolveValidationMessage({ max: { max: 9, actual: 12 } }, 'es')).toBe(
      'Introduzca un valor de como máximo 9.',
    );
    expect(resolveValidationMessage({ min: { min: 5, actual: 2 } }, 'ar')).toBe(
      'أدخل قيمة لا تقل عن 5.',
    );
  });

  it('localizes the email message without hardcoded English', () => {
    expect(resolveValidationMessage({ email: true }, 'en')).toBe('Enter a valid email address.');
    expect(resolveValidationMessage({ email: true }, 'ar')).toBe(
      'أدخل عنوان بريد إلكتروني صالحًا.',
    );
  });

  it('falls back to the generic message for unknown error keys', () => {
    expect(resolveValidationMessage({ pattern: { requiredPattern: '^a+$' } }, 'en')).toBe(
      'The value entered is invalid.',
    );
    expect(resolveValidationMessage({ customRule: true }, 'de')).toBe(
      'Der eingegebene Wert ist ungültig.',
    );
    expect(resolveValidationMessage({ server: ['Backend says no.'] }, 'ar')).toBe(
      'القيمة المدخلة غير صالحة.',
    );
  });

  it('resolves multi-error objects through a stable priority order', () => {
    expect(
      resolveValidationMessage(
        { maxlength: { requiredLength: 10, actualLength: 12 }, required: true },
        'en',
      ),
    ).toBe('This field is required.');
  });

  it('handles malformed payloads and unknown cultures deterministically', () => {
    expect(resolveValidationMessage({ minlength: true }, 'en')).toContain('{min}');
    expect(resolveValidationMessage({ required: true }, 'xx' as Culture)).toBe(
      'This field is required.',
    );
  });
});
