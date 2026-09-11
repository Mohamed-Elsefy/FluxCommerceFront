/**
 * Storefront Catalog feature translations for Sub-Phase 5.2 — Home &
 * Category Discovery.
 *
 * Feature-owned, business-specific copy (`catalog` namespace) in all five
 * supported cultures (`en`/`fr`/`de`/`es`/`ar`). Per the Phase 4 ownership
 * rule (translation-model: features own their namespaces alongside the
 * feature — they must not add business keys to the base resources), this
 * bundle lives in the catalog feature and never touches
 * `libs/i18n` dictionaries.
 *
 * Lookup runs through the Phase 4 `translate` engine (deterministic
 * target → `en` → key-path fallback, `{param}` interpolation), resolved
 * against the active `CultureService.culture()` at the consuming
 * component. Generic vocabulary stays in the base resources — components
 * resolve `common.actions.retry` via `translateKey` and API failures via
 * `resolveApiErrorMessage`, never duplicating them here.
 *
 * Pure data + pure lookup: no Angular, DOM, or storage access — SSR-safe.
 */

import {
  translate,
  type Culture,
  type TranslationDictionary,
  type TranslationResources,
} from '@flux/i18n';

/** Catalog translation key paths owned by this feature (`catalog.*`). */
export const CATALOG_TRANSLATION_KEYS = {
  categoriesTitle: 'catalog.categories.title',
  categoriesSubtitle: 'catalog.categories.subtitle',
  categoriesLoading: 'catalog.categories.loading',
  categoriesEmptyTitle: 'catalog.categories.emptyTitle',
  categoriesEmptyMessage: 'catalog.categories.emptyMessage',
  categoriesErrorTitle: 'catalog.categories.errorTitle',
  categoriesClearSelection: 'catalog.categories.clearSelection',
} as const;

/** English (`en`) catalog vocabulary. Also the deterministic fallback source. */
const EN_CATALOG: TranslationDictionary = {
  catalog: {
    categories: {
      title: 'Shop by category',
      subtitle: 'Browse the catalog through its categories.',
      loading: 'Loading categories…',
      emptyTitle: 'No categories yet',
      emptyMessage: 'Check back soon — new categories are on the way.',
      errorTitle: 'Categories unavailable',
      clearSelection: 'Show all categories',
    },
  },
};

/** French (`fr`) catalog vocabulary. */
const FR_CATALOG: TranslationDictionary = {
  catalog: {
    categories: {
      title: 'Acheter par catégorie',
      subtitle: 'Parcourez le catalogue par catégories.',
      loading: 'Chargement des catégories…',
      emptyTitle: 'Aucune catégorie pour le moment',
      emptyMessage: 'Revenez bientôt — de nouvelles catégories arrivent.',
      errorTitle: 'Catégories indisponibles',
      clearSelection: 'Afficher toutes les catégories',
    },
  },
};

/** German (`de`) catalog vocabulary. */
const DE_CATALOG: TranslationDictionary = {
  catalog: {
    categories: {
      title: 'Nach Kategorie stöbern',
      subtitle: 'Stöbern Sie anhand der Kategorien im Katalog.',
      loading: 'Kategorien werden geladen…',
      emptyTitle: 'Noch keine Kategorien',
      emptyMessage: 'Schauen Sie bald wieder vorbei — neue Kategorien sind unterwegs.',
      errorTitle: 'Kategorien nicht verfügbar',
      clearSelection: 'Alle Kategorien anzeigen',
    },
  },
};

/** Spanish (`es`) catalog vocabulary. */
const ES_CATALOG: TranslationDictionary = {
  catalog: {
    categories: {
      title: 'Comprar por categoría',
      subtitle: 'Explore el catálogo por categorías.',
      loading: 'Cargando las categorías…',
      emptyTitle: 'Aún no hay categorías',
      emptyMessage: 'Vuelva pronto: nuevas categorías en camino.',
      errorTitle: 'Categorías no disponibles',
      clearSelection: 'Mostrar todas las categorías',
    },
  },
};

/** Arabic (`ar`) catalog vocabulary. */
const AR_CATALOG: TranslationDictionary = {
  catalog: {
    categories: {
      title: 'تسوّق حسب الفئة',
      subtitle: 'تصفّح الكتالوج عبر الفئات.',
      loading: 'جارٍ تحميل الفئات…',
      emptyTitle: 'لا توجد فئات بعد',
      emptyMessage: 'عُد قريبًا — فئات جديدة في الطريق.',
      errorTitle: 'الفئات غير متاحة',
      clearSelection: 'عرض كل الفئات',
    },
  },
};

/** Bundled catalog dictionaries keyed by supported culture. */
export const CATALOG_TRANSLATION_RESOURCES: TranslationResources = {
  en: EN_CATALOG,
  fr: FR_CATALOG,
  de: DE_CATALOG,
  es: ES_CATALOG,
  ar: AR_CATALOG,
};

/**
 * Resolves a catalog key to its localized string with deterministic
 * fallback: target culture → `en` → the key path itself. Never throws.
 */
export function translateCatalogKey(culture: Culture, key: string): string {
  return translate(CATALOG_TRANSLATION_RESOURCES, culture, key);
}
