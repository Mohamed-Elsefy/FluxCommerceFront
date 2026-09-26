/**
 * Storefront Not-Found page translations for Sub-Phase 11.11 — 404 &
 * 500 Error Handling.
 *
 * Layout-owned 404 copy (`notFound` namespace) in all five supported
 * cultures (`en`/`fr`/`de`/`es`/`ar`). Colocated with the page it serves
 * (same ownership pattern as the home/catalog feature bundles — short
 * strings are duplicated, never imported across boundaries).
 *
 * Lookup runs through the Phase 4 `translate` engine (deterministic
 * target → `en` → key-path fallback). Pure data + pure lookup: no
 * Angular, DOM, or storage access — SSR-safe.
 */

import {
  translate,
  type Culture,
  type TranslationDictionary,
  type TranslationResources,
} from '@flux/i18n';

/** Not-found translation key paths owned by the layout (`notFound.*`). */
export const NOT_FOUND_TRANSLATION_KEYS = {
  title: 'notFound.title',
  message: 'notFound.message',
  backToHome: 'notFound.backToHome',
} as const;

/** English (`en`) not-found vocabulary. Also the deterministic fallback source. */
const EN_NOT_FOUND: TranslationDictionary = {
  notFound: {
    title: 'Page not found',
    message: 'The page you requested does not exist.',
    backToHome: 'Back to home',
  },
};

/** French (`fr`) not-found vocabulary. */
const FR_NOT_FOUND: TranslationDictionary = {
  notFound: {
    title: 'Page introuvable',
    message: "La page demandée n'existe pas.",
    backToHome: "Retour à l'accueil",
  },
};

/** German (`de`) not-found vocabulary. */
const DE_NOT_FOUND: TranslationDictionary = {
  notFound: {
    title: 'Seite nicht gefunden',
    message: 'Die angeforderte Seite existiert nicht.',
    backToHome: 'Zurück zur Startseite',
  },
};

/** Spanish (`es`) not-found vocabulary. */
const ES_NOT_FOUND: TranslationDictionary = {
  notFound: {
    title: 'Página no encontrada',
    message: 'La página solicitada no existe.',
    backToHome: 'Volver al inicio',
  },
};

/** Arabic (`ar`) not-found vocabulary. */
const AR_NOT_FOUND: TranslationDictionary = {
  notFound: {
    title: 'الصفحة غير موجودة',
    message: 'الصفحة التي طلبتها غير موجودة.',
    backToHome: 'العودة إلى الرئيسية',
  },
};

/** Bundled not-found dictionaries keyed by supported culture. */
export const NOT_FOUND_TRANSLATION_RESOURCES: TranslationResources = {
  en: EN_NOT_FOUND,
  fr: FR_NOT_FOUND,
  de: DE_NOT_FOUND,
  es: ES_NOT_FOUND,
  ar: AR_NOT_FOUND,
};

/**
 * Resolves a not-found key to its localized string with deterministic
 * fallback: target culture → `en` → the key path itself. Never throws.
 */
export function translateNotFoundKey(culture: Culture, key: string): string {
  return translate(NOT_FOUND_TRANSLATION_RESOURCES, culture, key);
}
