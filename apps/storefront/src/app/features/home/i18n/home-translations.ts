/**
 * Storefront Home feature translations for Sub-Phase 5.9 — Localization,
 * RTL & Responsive Integration.
 *
 * Feature-owned discovery-entry copy (`home` namespace) in all five
 * supported cultures (`en`/`fr`/`de`/`es`/`ar`). Per the Phase 4 ownership
 * rule, this bundle lives in the home feature: the catalog bundle stays
 * catalog-owned, so the short entry strings are intentionally duplicated
 * rather than imported across feature boundaries.
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

/** Home translation key paths owned by this feature (`home.*`). */
export const HOME_TRANSLATION_KEYS = {
  discoveryTitle: 'home.discovery.title',
  discoverySubtitle: 'home.discovery.subtitle',
  discoveryLink: 'home.discovery.link',
} as const;

/** English (`en`) home vocabulary. Also the deterministic fallback source. */
const EN_HOME: TranslationDictionary = {
  home: {
    discovery: {
      title: 'Discover products',
      subtitle: 'Browse the catalog through its categories.',
      link: 'Browse categories',
    },
  },
};

/** French (`fr`) home vocabulary. */
const FR_HOME: TranslationDictionary = {
  home: {
    discovery: {
      title: 'Découvrir des produits',
      subtitle: 'Parcourez le catalogue par catégories.',
      link: 'Parcourir les catégories',
    },
  },
};

/** German (`de`) home vocabulary. */
const DE_HOME: TranslationDictionary = {
  home: {
    discovery: {
      title: 'Produkte entdecken',
      subtitle: 'Stöbern Sie anhand der Kategorien im Katalog.',
      link: 'Kategorien durchsuchen',
    },
  },
};

/** Spanish (`es`) home vocabulary. */
const ES_HOME: TranslationDictionary = {
  home: {
    discovery: {
      title: 'Descubrir productos',
      subtitle: 'Explore el catálogo por categorías.',
      link: 'Explorar las categorías',
    },
  },
};

/** Arabic (`ar`) home vocabulary. */
const AR_HOME: TranslationDictionary = {
  home: {
    discovery: {
      title: 'اكتشف المنتجات',
      subtitle: 'تصفّح الكتالوج عبر الفئات.',
      link: 'تصفح الفئات',
    },
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
export function translateHomeKey(culture: Culture, key: string): string {
  return translate(HOME_TRANSLATION_RESOURCES, culture, key);
}
