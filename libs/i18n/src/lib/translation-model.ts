/**
 * Sub-Phase 4.2 — Translation resource model.
 *
 * Business-agnostic shapes shared by the bundled dictionaries and the lookup
 * engine. Dictionaries are nested objects with string leaves; keys are
 * dot-separated paths into that nesting.
 *
 * Key convention: lowercase dot-separated segments, `namespace.group.key`.
 *
 * ```text
 * common.actions.save
 * common.actions.cancel
 * common.validation.required
 * errors.unauthorized
 * errors.network
 * ```
 *
 * Namespaces reserved by the infrastructure: `common` (generic UI vocabulary)
 * and `errors` (generic failure vocabulary). Feature phases own their own
 * namespaces alongside the feature that introduces them — they must not add
 * business keys (catalog, cart, checkout, orders, …) to the base resources.
 *
 * Pure types only: no runtime code, no Angular, DOM, or storage access.
 */

import type { Culture } from './culture';

/**
 * Nested translation dictionary. Interior nodes are plain objects; leaves
 * are the localized strings. Lookup paths address leaves with dot-separated
 * keys (e.g. `'common.actions.save'`).
 */
export interface TranslationDictionary {
  readonly [key: string]: string | TranslationDictionary;
}

/** Bundled translation dictionaries keyed by supported culture. */
export type TranslationResources = Readonly<Record<Culture, TranslationDictionary>>;

/**
 * Dynamic values substituted into `{placeholder}` interpolation slots.
 * Only scalar primitives are allowed so rendering stays deterministic.
 */
export type TranslationParams = Readonly<Record<string, string | number | boolean>>;
