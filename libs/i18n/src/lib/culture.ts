/**
 * Sub-Phase 4.1 — Culture Model & Supported Cultures.
 *
 * Single source of truth for application cultures shared with the backend.
 * All culture lists, metadata, validation, and direction resolution derive
 * from {@link SUPPORTED_CULTURE_METADATA}, so no duplicated culture lists
 * or raw culture strings are needed downstream.
 *
 * ```text
 * SUPPORTED_CULTURE_METADATA (source of truth)
 *      ├── SUPPORTED_CULTURES (derived codes)
 *      ├── CULTURE_METADATA_BY_CODE (derived lookup)
 *      ├── DEFAULT_CULTURE ('en' fallback)
 *      ├── Validation (isSupportedCulture / parseCulture / resolveCulture)
 *      └── Direction (getCultureDirection / resolveCultureDirection)
 * ```
 *
 * Direction rules: `ar` → `rtl`; `en`, `fr`, `de`, `es` → `ltr`.
 *
 * Pure TypeScript with no Angular, DOM, or storage access: safe for SSR and
 * usable during server initialization. Translation resources, lookup, and
 * interpolation live in `./translation-model`, `./translation-dictionaries`,
 * and `./translations` (Sub-Phase 4.2); reactive state, switching,
 * persistence, and initialization live in `./culture.service` (Sub-Phase
 * 4.3). Explicitly out of scope (later sub-phases, must not appear here):
 * - 4.4+ — no document `dir` application or HTTP propagation.
 */

/** Culture identifiers supported by both backend and frontend. */
export type Culture = 'en' | 'fr' | 'de' | 'es' | 'ar';

/** Text direction associated with a culture. */
export type CultureDirection = 'ltr' | 'rtl';

/** Reusable metadata describing one supported culture. */
export interface CultureMetadata {
  /** Canonical culture code (e.g. `'en'`, `'ar'`). */
  readonly code: Culture;
  /** Native display name for language pickers (e.g. `'Français'`, `'العربية'`). */
  readonly displayName: string;
  /** Layout direction for the culture (`'rtl'` only for Arabic). */
  readonly direction: CultureDirection;
}

/**
 * Canonical registry of supported cultures in stable order.
 * The sole place where the culture list is written out.
 */
export const SUPPORTED_CULTURE_METADATA: readonly CultureMetadata[] = [
  { code: 'en', displayName: 'English', direction: 'ltr' },
  { code: 'fr', displayName: 'Français', direction: 'ltr' },
  { code: 'de', displayName: 'Deutsch', direction: 'ltr' },
  { code: 'es', displayName: 'Español', direction: 'ltr' },
  { code: 'ar', displayName: 'العربية', direction: 'rtl' },
];

/** All supported culture codes, derived from the registry (stable order). */
export const SUPPORTED_CULTURES: readonly Culture[] = SUPPORTED_CULTURE_METADATA.map(
  (metadata) => metadata.code,
);

/** Culture used whenever no valid culture is available. */
export const DEFAULT_CULTURE: Culture = 'en';

/** Lookup of metadata by culture code, derived from the registry. */
export const CULTURE_METADATA_BY_CODE: Readonly<Record<Culture, CultureMetadata>> =
  Object.fromEntries(
    SUPPORTED_CULTURE_METADATA.map((metadata) => [metadata.code, metadata]),
  ) as Record<Culture, CultureMetadata>;

/**
 * Narrows an arbitrary value to a supported culture using an exact match.
 * Non-strings and unsupported codes return `false` (never throws).
 * Case/whitespace variants (e.g. `'EN'`) are not considered supported here;
 * use {@link parseCulture} to normalize them to their canonical code.
 */
export function isSupportedCulture(value: unknown): value is Culture {
  return typeof value === 'string' && (SUPPORTED_CULTURES as readonly string[]).includes(value);
}

/**
 * Strictly parses an arbitrary value to its canonical culture code.
 * Normalizes string inputs (trim + lowercase); returns `null` for anything
 * unsupported instead of echoing the raw input. Never throws.
 */
export function parseCulture(value: unknown): Culture | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return isSupportedCulture(normalized) ? normalized : null;
}

/**
 * Resolves an arbitrary value to a usable culture, falling back
 * deterministically to {@link DEFAULT_CULTURE}. Never throws.
 */
export function resolveCulture(value: unknown): Culture {
  return parseCulture(value) ?? DEFAULT_CULTURE;
}

/**
 * Returns the registry metadata for a supported culture.
 * Falls back to the default culture entry defensively (never throws).
 */
export function getCultureMetadata(culture: Culture): CultureMetadata {
  return CULTURE_METADATA_BY_CODE[culture] ?? CULTURE_METADATA_BY_CODE[DEFAULT_CULTURE];
}

/**
 * Resolves an arbitrary value to its registry metadata, falling back
 * deterministically to the default culture entry. Never throws.
 */
export function resolveCultureMetadata(value: unknown): CultureMetadata {
  return getCultureMetadata(resolveCulture(value));
}

/**
 * Returns the layout direction for a supported culture
 * (`'rtl'` for Arabic, `'ltr'` otherwise). Never throws.
 */
export function getCultureDirection(culture: Culture): CultureDirection {
  return getCultureMetadata(culture).direction;
}

/**
 * Resolves an arbitrary value to a layout direction, falling back
 * deterministically to the default culture direction. Never throws.
 */
export function resolveCultureDirection(value: unknown): CultureDirection {
  return getCultureDirection(resolveCulture(value));
}
