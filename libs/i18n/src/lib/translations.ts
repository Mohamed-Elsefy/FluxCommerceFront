/**
 * Sub-Phase 4.2 — Translation lookup engine and resource loading.
 *
 * Pure functions over {@link TranslationResources}: nested key lookup,
 * `{placeholder}` interpolation, deterministic fallback, and loading of the
 * statically bundled dictionaries. No Angular, DOM, or storage access, so
 * every function is SSR-safe and never throws.
 *
 * Resolution order for `translate` / `translateKey`:
 *
 * ```text
 * Target culture dictionary
 *      ↓ (key missing)
 * Default culture ('en') dictionary
 *      ↓ (key missing)
 * Key path itself (missing-key behavior: graceful, UI never crashes)
 * ```
 *
 * Interpolation runs last on the resolved template. Slots without a
 * matching param are left intact (`{missing}` renders as-is) instead of
 * throwing or blanking the output.
 *
 * Explicitly out of scope (later sub-phases, must not appear here):
 * - 4.3 owns reactive state — this engine stays a pure function of its
 *   inputs (culture passed explicitly, e.g. from `CultureService.culture()`).
 * - 4.4+ — no document `dir` application or HTTP propagation.
 */

import { DEFAULT_CULTURE, resolveCulture, type Culture } from './culture';
import { TRANSLATION_RESOURCES } from './translation-dictionaries';
import type {
  TranslationDictionary,
  TranslationParams,
  TranslationResources,
} from './translation-model';

/**
 * Loads the bundled dictionary for a culture, falling back deterministically
 * to the default culture dictionary for unknown inputs. Static (synchronous)
 * by design: resources ship with the bundle so SSR and hydration always have
 * them. Never throws.
 */
export function loadTranslationDictionary(culture: Culture): TranslationDictionary {
  const resolved = resolveCulture(culture);
  return TRANSLATION_RESOURCES[resolved] ?? TRANSLATION_RESOURCES[DEFAULT_CULTURE];
}

/**
 * Looks up a dot-separated key path (e.g. `'common.actions.save'`) in one
 * dictionary. Returns the leaf string, or `undefined` when the path is
 * missing, empty, or lands on an interior (non-string) node. Never throws.
 */
export function lookupTranslationKey(
  dictionary: TranslationDictionary,
  key: string,
): string | undefined {
  const segments = key.split('.').filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return undefined;
  }
  let current: string | TranslationDictionary = dictionary;
  for (const segment of segments) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    const next: string | TranslationDictionary | undefined = current[segment];
    if (next === undefined) {
      return undefined;
    }
    current = next;
  }
  return typeof current === 'string' ? current : undefined;
}

/**
 * Substitutes `{placeholder}` slots in a template with the matching params.
 * Unknown slots are preserved verbatim; extra params are ignored. Never
 * throws — non-string-safe values cannot occur by construction of
 * {@link TranslationParams}.
 */
export function interpolateTranslation(template: string, params: TranslationParams = {}): string {
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (slot, name: string) => {
    const value: string | number | boolean | undefined = params[name];
    return value === undefined ? slot : String(value);
  });
}

/**
 * Reports whether a key resolves to a string in a culture's dictionary
 * without applying fallback. Useful for tooling and diagnostics; rendering
 * should prefer {@link translate}, which never returns `undefined`.
 */
export function hasTranslation(
  resources: TranslationResources,
  culture: Culture,
  key: string,
): boolean {
  const dictionary = resources[resolveCulture(culture)];
  return dictionary !== undefined && lookupTranslationKey(dictionary, key) !== undefined;
}

/**
 * Resolves a key to its localized string with deterministic fallback:
 * target culture → default culture (`'en'`) → the key path itself.
 * Interpolation applies to the resolved template. Accepts any resource
 * bundle (custom bundles stay testable without the default resources).
 * Never throws.
 */
export function translate(
  resources: TranslationResources,
  culture: Culture,
  key: string,
  params: TranslationParams = {},
): string {
  const target = resources[resolveCulture(culture)];
  const targetHit = target === undefined ? undefined : lookupTranslationKey(target, key);
  if (targetHit !== undefined) {
    return interpolateTranslation(targetHit, params);
  }
  const fallback = resources[DEFAULT_CULTURE];
  const fallbackHit = fallback === undefined ? undefined : lookupTranslationKey(fallback, key);
  if (fallbackHit !== undefined) {
    return interpolateTranslation(fallbackHit, params);
  }
  return key;
}

/**
 * Convenience translation against the statically bundled base resources:
 * `translate(TRANSLATION_RESOURCES, culture, key, params)`.
 */
export function translateKey(
  culture: Culture,
  key: string,
  params: TranslationParams = {},
): string {
  return translate(TRANSLATION_RESOURCES, culture, key, params);
}
