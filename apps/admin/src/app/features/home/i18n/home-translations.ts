/**
 * Admin home feature translations — user-facing copy (`home.*`) in all
 * five supported cultures (`en`/`fr`/`de`/`es`/`ar`).
 *
 * Covers the portal landing placeholder. Lookup runs through the Phase 4
 * `translate` engine (deterministic target → `en` → key-path fallback).
 * Pure data + pure lookup: no Angular, DOM, or storage access —
 * SSR-safe.
 */

import {
  translate,
  type Culture,
  type TranslationDictionary,
  type TranslationParams,
  type TranslationResources,
} from '@flux/i18n';

/** Home translation key paths owned by this feature (`home.*`). */
export const HOME_TRANSLATION_KEYS = {
  title: 'home.title',
  subtitle: 'home.subtitle',
} as const;

/** English (`en`) home vocabulary. Also the deterministic fallback source. */
const EN_HOME: TranslationDictionary = {
  home: {
    title: 'Admin',
    subtitle: 'Application shell ready. Business features arrive in later phases.',
  },
};

/** French (`fr`) home vocabulary. */
const FR_HOME: TranslationDictionary = {
  home: {
    title: 'Admin',
    subtitle:
      'Coquille applicative prête. Les fonctions métier arrivent dans les phases suivantes.',
  },
};

/** German (`de`) home vocabulary. */
const DE_HOME: TranslationDictionary = {
  home: {
    title: 'Admin',
    subtitle: 'Anwendungs-Shell bereit. Fachfunktionen folgen in späteren Phasen.',
  },
};

/** Spanish (`es`) home vocabulary. */
const ES_HOME: TranslationDictionary = {
  home: {
    title: 'Admin',
    subtitle: 'Estructura lista. Las funciones llegan en fases posteriores.',
  },
};

/** Arabic (`ar`) home vocabulary. */
const AR_HOME: TranslationDictionary = {
  home: {
    title: 'الإدارة',
    subtitle: 'الهيكل جاهز. المزايا تصل في المراحل التالية.',
  },
};

/** Bundled home dictionaries keyed by supported culture. */
export const HOME_TRANSLATION_RESOURCES: TranslationResources = {
  en: EN_HOME,
  fr: FR_HOME,
  de: DE_HOME,
  es: ES_HOME,
  ar: AR_HOME,
};

/**
 * Resolves a home key to its localized string with deterministic
 * fallback: target culture → `en` → the key path itself. Never throws.
 */
export function translateHomeKey(
  culture: Culture,
  key: string,
  params: TranslationParams = {},
): string {
  return translate(HOME_TRANSLATION_RESOURCES, culture, key, params);
}
