/**
 * `libs/i18n` foundation.
 *
 * Owns the culture identifiers shared with the backend. Translation
 * loading, language switching, persistence and RTL behavior arrive
 * with Phase 4.
 */

/** Culture identifiers supported by both backend and frontend. */
export type Culture = 'en' | 'fr' | 'de' | 'es' | 'ar';

/** All supported cultures in a stable order. */
export const SUPPORTED_CULTURES: readonly Culture[] = ['en', 'fr', 'de', 'es', 'ar'];

/** Culture used before the user selects one. */
export const DEFAULT_CULTURE: Culture = 'en';

/** Narrows an arbitrary string to a supported culture. */
export function isSupportedCulture(value: string): value is Culture {
  return (SUPPORTED_CULTURES as readonly string[]).includes(value);
}
