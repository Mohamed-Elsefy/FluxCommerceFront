/**
 * Payments feature error localization for Sub-Phase 9.10 — Payment UI
 * & Checkout Integration.
 *
 * Connects the normalized Phase 1 `ApiError` model to the feature-owned
 * payment bundle (`./payment-translations`):
 *
 * ```text
 * Normalized ApiError (status + best-effort code)
 *      ↓ resolvePaymentErrorMessage (feature code → feature key;
 *        decline text passes through; else base status fallback)
 * Localized message | null
 *      ↓
 * UI shells (null hides — never backend text, never technical internals)
 * ```
 *
 * Resolution rules (code-first, never message text):
 * - `PaymentDeclined` with displayable provider text → the provider
 *   text verbatim (Stripe decline copy is user-facing by nature).
 * - Other payment-stable codes → the feature `payment.errors.*` key
 *   (`PaymentContractBlocked` legacy, `ProviderSetupFailed`,
 *   `Payment.Failed`, `Payment.NotFound`, declined fallback, plus the
 *   by-order reads: `Payment.NotReady`/`Payment.ProviderUnavailable` →
 *   retry copy, `Payment.NotPayable` → terminal copy,
 *   `Payment.OrderIdRequired` → retry copy).
 * - Codeless `404`s (the common wire reality on `by-order`/`payments`
 *   reads — business responses carry no `extensions.code`) → the
 *   feature `notFound` copy (accurate for unknown and masked-ownership
 *   ids alike; never backend text).
 * - Anything else (unknown codes, other codeless statuses, nullish
 *   errors) → the shared base resolver (`errors.*` by status, generic
 *   fallback). `null` error input resolves to `null` (nothing to
 *   display — the shells hide), NOT to generic copy.
 *
 * Security rule (the §9.10 guardrail): technical diagnostics
 * (setup failures, transport details, saga-lag internals) NEVER reach
 * the user — they resolve to generic localized copy. Identifiers and
 * secrets never appear in any branch (asserted in spec via leakage
 * sweeps).
 *
 * Pure functions, no DOM or storage access: safe for SSR.
 */

import type { ApiError } from '@flux/api';
import { resolveApiErrorMessage, type Culture } from '@flux/i18n';
import { PAYMENT_TRANSLATION_KEYS, translatePaymentKey } from './payment-translations';

/** Feature error-code → `payment.errors.*` key mapping (stable codes only). */
const PAYMENT_ERROR_TRANSLATION_KEYS: Readonly<Record<string, string>> = {
  PaymentContractBlocked: PAYMENT_TRANSLATION_KEYS.errorUnavailable,
  ProviderSetupFailed: PAYMENT_TRANSLATION_KEYS.errorSetupFailed,
  'Payment.Failed': PAYMENT_TRANSLATION_KEYS.errorVerificationFailed,
  'Payment.NotFound': PAYMENT_TRANSLATION_KEYS.errorNotFound,
  PaymentDeclined: PAYMENT_TRANSLATION_KEYS.errorDeclinedFallback,
  'Payment.NotReady': PAYMENT_TRANSLATION_KEYS.errorUnavailable,
  'Payment.NotPayable': PAYMENT_TRANSLATION_KEYS.errorVerificationFailed,
  'Payment.ProviderUnavailable': PAYMENT_TRANSLATION_KEYS.errorUnavailable,
  'Payment.OrderIdRequired': PAYMENT_TRANSLATION_KEYS.errorUnavailable,
};

/**
 * Resolves a normalized payment failure to user-facing copy for a
 * culture, or `null` when there is no failure to display. Never throws,
 * never echoes identifiers or secrets.
 */
export function resolvePaymentErrorMessage(
  error: ApiError | null | undefined,
  culture: Culture,
): string | null {
  if (error === null || error === undefined) {
    return null;
  }
  if (
    error.code === 'PaymentDeclined' &&
    typeof error.message === 'string' &&
    error.message.trim() !== ''
  ) {
    return error.message;
  }
  const key =
    typeof error.code === 'string' ? PAYMENT_ERROR_TRANSLATION_KEYS[error.code] : undefined;
  if (key !== undefined) {
    return translatePaymentKey(culture, key);
  }
  if (error.status === 404) {
    return translatePaymentKey(culture, PAYMENT_TRANSLATION_KEYS.errorNotFound);
  }
  return resolveApiErrorMessage(error, culture);
}
