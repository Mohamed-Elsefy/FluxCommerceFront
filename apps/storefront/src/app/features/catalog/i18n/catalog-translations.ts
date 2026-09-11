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
  type TranslationParams,
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
  listingTitle: 'catalog.listing.title',
  listingLoading: 'catalog.listing.loading',
  listingEmptyTitle: 'catalog.listing.emptyTitle',
  listingEmptyMessage: 'catalog.listing.emptyMessage',
  listingErrorTitle: 'catalog.listing.errorTitle',
  listingResultCount: 'catalog.listing.resultCount',
  searchLabel: 'catalog.search.label',
  searchPlaceholder: 'catalog.search.placeholder',
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
    listing: {
      title: 'Products',
      loading: 'Loading products…',
      emptyTitle: 'No products found',
      emptyMessage: 'Try another category — new products arrive often.',
      errorTitle: 'Products unavailable',
      resultCount: '{count} products',
    },
    search: {
      label: 'Search products',
      placeholder: 'Search by keyword…',
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
    listing: {
      title: 'Produits',
      loading: 'Chargement des produits…',
      emptyTitle: 'Aucun produit trouvé',
      emptyMessage: 'Essayez une autre catégorie — de nouveaux produits arrivent souvent.',
      errorTitle: 'Produits indisponibles',
      resultCount: '{count} produits',
    },
    search: {
      label: 'Rechercher des produits',
      placeholder: 'Rechercher par mot-clé…',
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
    listing: {
      title: 'Produkte',
      loading: 'Produkte werden geladen…',
      emptyTitle: 'Keine Produkte gefunden',
      emptyMessage: 'Versuchen Sie eine andere Kategorie — neue Produkte treffen häufig ein.',
      errorTitle: 'Produkte nicht verfügbar',
      resultCount: '{count} Produkte',
    },
    search: {
      label: 'Produkte suchen',
      placeholder: 'Nach Stichwort suchen…',
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
    listing: {
      title: 'Productos',
      loading: 'Cargando los productos…',
      emptyTitle: 'No se encontraron productos',
      emptyMessage: 'Pruebe con otra categoría: llegan productos nuevos con frecuencia.',
      errorTitle: 'Productos no disponibles',
      resultCount: '{count} productos',
    },
    search: {
      label: 'Buscar productos',
      placeholder: 'Buscar por palabra clave…',
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
    listing: {
      title: 'المنتجات',
      loading: 'جارٍ تحميل المنتجات…',
      emptyTitle: 'لم يتم العثور على منتجات',
      emptyMessage: 'جرّب فئة أخرى — تصل منتجات جديدة باستمرار.',
      errorTitle: 'المنتجات غير متاحة',
      resultCount: '{count} منتجات',
    },
    search: {
      label: 'البحث في المنتجات',
      placeholder: 'البحث بكلمة مفتاحية…',
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
 * fallback: target culture → `en` → the key path itself. `params` fills
 * `{placeholder}` slots (e.g. `{count}`). Never throws.
 */
export function translateCatalogKey(
  culture: Culture,
  key: string,
  params: TranslationParams = {},
): string {
  return translate(CATALOG_TRANSLATION_RESOURCES, culture, key, params);
}
