/**
 * Sub-Phase 4.7 — API error localization.
 *
 * Connects the normalized Phase 1 `ApiError` model to the localization
 * infrastructure:
 *
 * ```text
 * API Response
 *      ↓ (Phase 1 normalization)
 * Normalized ApiError (status + best-effort code)
 *      ↓ mapErrorCodeToTranslationKey (known code, else status rule, else fallback)
 * Translation key
 *      ↓ translateKey (Sub-Phase 4.2 engine, deterministic 'en' fallback)
 * Localized message
 *      ↓
 * UI (branches on code/status via this resolver — never on message text)
 * ```
 *
 * Resolution rules:
 * - Known stable code → its mapped key. Lookup is exact first, then
 *   case-insensitive, so `ValidationError`, `VALIDATION_ERROR`, and padded
 *   variants all resolve identically.
 * - Codeless errors (the common wire reality — business responses carry no
 *   `extensions.code`) resolve by status/shape: `401` → unauthorized,
 *   `403` → forbidden, `400` with a validation map → validation.
 * - Anything else — unknown codes (including domain codes such as
 *   `Identity.UserNotFound` whose resources belong to future feature phases),
 *   other codeless statuses, and nullish errors — resolves to the generic
 *   `errors.unknown` message. Deterministic across cultures; never throws.
 *
 * UI contract: components rely exclusively on this resolver's output for
 * user-facing copy. Server-provided text (`ApiError.message`) stays
 * available for diagnostics but is never branched on or rendered as
 * business logic. Cancellation (`RequestCancelled`) resolves generically —
 * callers typically skip resolution for aborted requests entirely.
 *
 * Business-independent: only common codes and the generic fallback live
 * here. Domain-specific codes and resources arrive with the features that
 * own them. Pure functions, no DOM or storage access: safe for SSR.
 */

import type { ApiError } from '@flux/api';
import type { Culture } from '../culture/culture';
import { translateKey } from '../translations/translations';

/** Fallback key for unknown codes, unmapped statuses, and nullish errors. */
export const UNKNOWN_ERROR_TRANSLATION_KEY = 'errors.unknown';

/**
 * Common error-code → base translation-key mapping. Covers the stable
 * client-synthesized transport codes plus the generic word codes backends
 * may send; domain codes (`Identity.*`, `Cart.*`, …) intentionally stay
 * unmapped here — they resolve through the generic fallback until their
 * owning feature registers resources.
 */
export const ERROR_CODE_TRANSLATION_KEYS: Readonly<Record<string, string>> = {
  NetworkError: 'errors.network',
  RequestCancelled: 'errors.unknown',
  UnknownError: 'errors.unknown',
  ValidationError: 'errors.validation',
  VALIDATION_ERROR: 'errors.validation',
  Unauthorized: 'errors.unauthorized',
  UNAUTHORIZED: 'errors.unauthorized',
  Forbidden: 'errors.forbidden',
  FORBIDDEN: 'errors.forbidden',
};

/**
 * Maps a stable error code to its base translation key. Normalizes
 * whitespace and case; unknown, empty, or non-string codes resolve to the
 * generic fallback key. Never throws.
 */
export function mapErrorCodeToTranslationKey(code: string | null | undefined): string {
  if (typeof code !== 'string') {
    return UNKNOWN_ERROR_TRANSLATION_KEY;
  }
  const trimmed = code.trim();
  if (trimmed === '') {
    return UNKNOWN_ERROR_TRANSLATION_KEY;
  }
  return (
    ERROR_CODE_TRANSLATION_KEYS[trimmed] ??
    ERROR_CODE_TRANSLATION_KEYS[trimmed.toUpperCase()] ??
    UNKNOWN_ERROR_TRANSLATION_KEY
  );
}

/**
 * Resolves a normalized API error to its localized message for a culture.
 * Known codes use the mapping above; codeless `401`/`403`/validation-`400`
 * resolve by status and shape; everything else (including nullish errors)
 * resolves to the generic message. Never throws.
 */
export function resolveApiErrorMessage(
  error: ApiError | null | undefined,
  culture: Culture,
): string {
  if (error === null || error === undefined) {
    return translateKey(culture, UNKNOWN_ERROR_TRANSLATION_KEY);
  }
  if (error.code !== undefined) {
    return translateKey(culture, mapErrorCodeToTranslationKey(error.code));
  }
  switch (error.status) {
    case 401:
      return translateKey(culture, 'errors.unauthorized');
    case 403:
      return translateKey(culture, 'errors.forbidden');
    case 400:
      return translateKey(
        culture,
        error.validationErrors === undefined ? UNKNOWN_ERROR_TRANSLATION_KEY : 'errors.validation',
      );
    default:
      return translateKey(culture, UNKNOWN_ERROR_TRANSLATION_KEY);
  }
}
