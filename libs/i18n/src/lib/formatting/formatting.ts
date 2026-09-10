/**
 * Sub-Phase 4.6 — Culture-aware formatting abstractions.
 *
 * Pure presentation-agnostic functions over the platform `Intl` API:
 *
 * ```text
 * Date + Culture                 → Localized Date
 * Number + Culture               → Localized Number
 * Amount + Currency + Culture    → Localized Currency
 * ```
 *
 * Every function takes the culture explicitly (callers pass the active
 * `CultureService.culture()`, so output follows runtime language switches)
 * and validates it through the Sub-Phase 4.1 utilities. Invalid values and
 * invalid `Intl` options resolve deterministically to `''` instead of
 * throwing, so formatting can never crash rendering. No Angular, DOM, or
 * storage access: safe for SSR.
 *
 * Timezone note: date output uses the runtime timezone unless the caller
 * passes an explicit `timeZone` option. Prefer an explicit timezone for
 * SSR-stable output (server and browser runtimes may differ).
 *
 * Strictly business-independent: no catalog/cart/checkout/orders concepts.
 * Business-specific formatting (if ever needed) belongs to the owning
 * feature. Explicitly out of scope (later sub-phases, must not appear here):
 * - 4.7 — no API error-code localization mapping.
 */

import { resolveCulture, type Culture } from '../culture/culture';

/**
 * BCP 47 locales used for formatting per culture. Codes pass through
 * unchanged except `ar`, which maps to `ar-u-nu-arab`: bare `ar` selects
 * Latin digits per CLDR, while the storefront (and the backend `ar`
 * culture) renders Arabic-Indic digits. Only the numbering system changes —
 * the Gregorian calendar and Arabic separators stay as bare `ar` defines
 * them. Centralized here so the mapping cannot drift per call site.
 */
const FORMATTING_LOCALES: Readonly<Record<Culture, string>> = {
  en: 'en',
  fr: 'fr',
  de: 'de',
  es: 'es',
  ar: 'ar-u-nu-arab',
};

/** Resolves a culture to its formatting locale. */
function formattingLocale(culture: Culture): string {
  return FORMATTING_LOCALES[resolveCulture(culture)];
}

/**
 * Formats a date (or parseable date value) for a culture.
 * Returns `''` for unparseable values or invalid options. Never throws.
 */
export function formatDate(
  value: Date | string | number,
  culture: Culture,
  options: Intl.DateTimeFormatOptions = {},
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  try {
    return new Intl.DateTimeFormat(formattingLocale(culture), options).format(date);
  } catch {
    return '';
  }
}

/**
 * Formats a number for a culture (grouping, decimals, percent via options).
 * Returns `''` for non-finite values or invalid options. Never throws.
 */
export function formatNumber(
  value: number,
  culture: Culture,
  options: Intl.NumberFormatOptions = {},
): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '';
  }
  try {
    return new Intl.NumberFormat(formattingLocale(culture), options).format(value);
  } catch {
    return '';
  }
}

/**
 * Formats a monetary amount for a culture (`currency` is the ISO 4217 code,
 * e.g. `'USD'`, `'EUR'`). Returns `''` for non-finite amounts or invalid
 * currency codes/options. Never throws.
 */
export function formatCurrency(
  amount: number,
  currency: string,
  culture: Culture,
  options: Omit<Intl.NumberFormatOptions, 'style' | 'currency'> = {},
): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return '';
  }
  const code = typeof currency === 'string' ? currency.trim().toUpperCase() : '';
  if (code === '') {
    return '';
  }
  try {
    return new Intl.NumberFormat(formattingLocale(culture), {
      ...options,
      style: 'currency',
      currency: code,
    }).format(amount);
  } catch {
    return '';
  }
}
