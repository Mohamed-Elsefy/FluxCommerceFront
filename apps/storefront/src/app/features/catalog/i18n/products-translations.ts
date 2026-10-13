/**
 * Storefront Products feature translations — listing-page chrome
 * (`products.*`) in all five supported cultures.
 *
 * Control copy (search/filters/sort/pagination) is catalog-owned and stays
 * in the catalog bundle: this page reuses those components, and the short
 * page-chrome strings are feature-owned here (same duplication pattern as
 * the home bundle — never imported across feature boundaries).
 */

import {
  translate,
  type Culture,
  type TranslationDictionary,
  type TranslationResources,
} from '@flux/i18n';

/** Products translation key paths owned by this page (`products.*`). */
export const PRODUCTS_TRANSLATION_KEYS = {
  title: 'products.title',
  subtitle: 'products.subtitle',
  pageSize: 'products.pageSize',
  allCategories: 'products.allCategories',
} as const;

const EN_PRODUCTS: TranslationDictionary = {
  products: {
    title: 'Products',
    subtitle: 'Search the full shelf, filter by availability, and sort your way.',
    pageSize: 'Per page',
    allCategories: 'All',
  },
};

const FR_PRODUCTS: TranslationDictionary = {
  products: {
    title: 'Produits',
    subtitle: 'Recherchez tout le rayon, filtrez et triez à votre façon.',
    pageSize: 'Par page',
    allCategories: 'Tout',
  },
};

const DE_PRODUCTS: TranslationDictionary = {
  products: {
    title: 'Produkte',
    subtitle: 'Durchsuchen Sie das volle Regal, filtern und sortieren Sie.',
    pageSize: 'Pro Seite',
    allCategories: 'Alle',
  },
};

const ES_PRODUCTS: TranslationDictionary = {
  products: {
    title: 'Productos',
    subtitle: 'Busque todo el estante, filtre y ordene a su gusto.',
    pageSize: 'Por página',
    allCategories: 'Todo',
  },
};

const AR_PRODUCTS: TranslationDictionary = {
  products: {
    title: 'المنتجات',
    subtitle: 'ابحث في الرف الكامل ورتب حسب ما يناسبك.',
    pageSize: 'لكل صفحة',
    allCategories: 'الكل',
  },
};

/** Bundled products dictionaries keyed by supported culture. */
export const PRODUCTS_TRANSLATION_RESOURCES: TranslationResources = {
  en: EN_PRODUCTS,
  fr: FR_PRODUCTS,
  de: DE_PRODUCTS,
  es: ES_PRODUCTS,
  ar: AR_PRODUCTS,
};

/** Resolves a products key with deterministic target → `en` → key-path fallback. */
export function translateProductsKey(culture: Culture, key: string): string {
  return translate(PRODUCTS_TRANSLATION_RESOURCES, culture, key);
}
