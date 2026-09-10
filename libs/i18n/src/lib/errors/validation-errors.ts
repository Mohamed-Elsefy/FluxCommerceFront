/**
 * Sub-Phase 4.6 — Localized validation-message resolution.
 *
 * Bridges Angular reactive-form `ValidationErrors` to the localized base
 * vocabulary (`common.validation.*`) without hardcoding English:
 *
 * ```text
 * ValidationErrors + Culture
 *      ↓ resolveValidationMessage
 * Localized message (or null when there is nothing to report)
 * ```
 *
 * Only generic constraints are mapped (`required`, `email`, `minlength`,
 * `maxlength`, `min`, `max` — the shapes produced by Angular's built-in
 * `Validators`). Anything else (patterns, custom validators, the `server`
 * key used for backend field errors) resolves to the generic
 * `common.validation.invalid` message. Business-specific messages stay
 * outside Phase 4 with the features that own them.
 *
 * Multi-error objects resolve through a fixed priority order, so output is
 * stable regardless of key insertion order. Lookup runs through the
 * Sub-Phase 4.2 engine (deterministic `'en'` fallback included). Pure
 * functions, no DOM or storage access: safe for SSR. Never throws.
 *
 * Explicitly out of scope (later sub-phases, must not appear here):
 * - 4.7 — no API error-code localization mapping.
 */

import type { ValidationErrors } from '@angular/forms';
import type { Culture } from '../culture/culture';
import type { TranslationParams } from '../translations/translation-model';
import { translateKey } from '../translations/translations';

/** Generic constraints mapped to base resources, in stable resolution priority. */
const VALIDATION_MESSAGE_ORDER: readonly string[] = [
  'required',
  'email',
  'minlength',
  'maxlength',
  'min',
  'max',
];

/** Extracts interpolation params from an Angular validator payload. */
function validationParams(errorKey: string, details: unknown): TranslationParams {
  if (typeof details !== 'object' || details === null) {
    return {};
  }
  const payload = details as Record<string, string | number | boolean | undefined>;
  switch (errorKey) {
    case 'minlength':
      return payload['requiredLength'] === undefined
        ? {}
        : { min: payload['requiredLength'] as string | number | boolean };
    case 'maxlength':
      return payload['requiredLength'] === undefined
        ? {}
        : { max: payload['requiredLength'] as string | number | boolean };
    case 'min':
      return payload['min'] === undefined
        ? {}
        : { min: payload['min'] as string | number | boolean };
    case 'max':
      return payload['max'] === undefined
        ? {}
        : { max: payload['max'] as string | number | boolean };
    default:
      return {};
  }
}

/** Maps a generic Angular error key to its base translation key. */
function validationTranslationKey(errorKey: string): string {
  switch (errorKey) {
    case 'minlength':
      return 'common.validation.minLength';
    case 'maxlength':
      return 'common.validation.maxLength';
    default:
      return `common.validation.${errorKey}`;
  }
}

/**
 * Resolves Angular validation errors to a localized message for a culture.
 * Returns `null` when there is nothing to report. Unknown error keys fall
 * back to the generic invalid message. Never throws.
 */
export function resolveValidationMessage(
  errors: ValidationErrors | null | undefined,
  culture: Culture,
): string | null {
  if (errors === null || errors === undefined) {
    return null;
  }
  const known = VALIDATION_MESSAGE_ORDER.find((key) => errors[key] !== undefined);
  if (known !== undefined) {
    return translateKey(
      culture,
      validationTranslationKey(known),
      validationParams(known, errors[known]),
    );
  }
  if (Object.keys(errors).length === 0) {
    return null;
  }
  return translateKey(culture, 'common.validation.invalid');
}
