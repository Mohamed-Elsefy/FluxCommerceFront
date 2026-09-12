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
  listingNoResultsTitle: 'catalog.listing.noResultsTitle',
  listingNoResultsMessage: 'catalog.listing.noResultsMessage',
  listingNoProductsTitle: 'catalog.listing.noProductsTitle',
  listingNoProductsMessage: 'catalog.listing.noProductsMessage',
  listingThisCategory: 'catalog.listing.thisCategory',
  listingErrorTitle: 'catalog.listing.errorTitle',
  listingResultCount: 'catalog.listing.resultCount',
  searchLabel: 'catalog.search.label',
  searchPlaceholder: 'catalog.search.placeholder',
  filtersStatusLabel: 'catalog.filters.statusLabel',
  filtersVisibilityLabel: 'catalog.filters.visibilityLabel',
  filtersSortLabel: 'catalog.filters.sortLabel',
  filtersAll: 'catalog.filters.all',
  filtersStatusDraft: 'catalog.filters.statusDraft',
  filtersStatusActive: 'catalog.filters.statusActive',
  filtersStatusInactive: 'catalog.filters.statusInactive',
  filtersStatusArchived: 'catalog.filters.statusArchived',
  filtersVisibilityVisible: 'catalog.filters.visibilityVisible',
  filtersVisibilityHidden: 'catalog.filters.visibilityHidden',
  filtersSortDefault: 'catalog.sort.default',
  filtersSortNameAsc: 'catalog.sort.nameAsc',
  filtersSortNameDesc: 'catalog.sort.nameDesc',
  filtersSortNewest: 'catalog.sort.newest',
  filtersSortOldest: 'catalog.sort.oldest',
  filtersClearAll: 'catalog.filters.clearAll',
  paginationLabel: 'catalog.pagination.label',
  paginationFirst: 'catalog.pagination.first',
  paginationPrevious: 'catalog.pagination.previous',
  paginationNext: 'catalog.pagination.next',
  paginationLast: 'catalog.pagination.last',
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
      noResultsTitle: 'No matching products',
      noResultsMessage: 'Try a different search or clear some filters.',
      noProductsTitle: 'No products here yet',
      noProductsMessage: 'There are no products in {category} yet.',
      thisCategory: 'this category',
      errorTitle: 'Products unavailable',
      resultCount: '{count} products',
    },
    search: {
      label: 'Search products',
      placeholder: 'Search by keyword…',
    },
    filters: {
      statusLabel: 'Status',
      visibilityLabel: 'Visibility',
      sortLabel: 'Sort by',
      all: 'All',
      statusDraft: 'Draft',
      statusActive: 'Active',
      statusInactive: 'Inactive',
      statusArchived: 'Archived',
      visibilityVisible: 'Visible',
      visibilityHidden: 'Hidden',
      clearAll: 'Clear all filters',
    },
    sort: {
      default: 'Default',
      nameAsc: 'Name (A–Z)',
      nameDesc: 'Name (Z–A)',
      newest: 'Newest first',
      oldest: 'Oldest first',
    },
    pagination: {
      label: 'Product pages',
      first: 'First',
      previous: 'Previous',
      next: 'Next',
      last: 'Last',
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
      noResultsTitle: 'Aucun produit correspondant',
      noResultsMessage: 'Essayez une autre recherche ou retirez certains filtres.',
      noProductsTitle: 'Aucun produit ici pour le moment',
      noProductsMessage: "Il n'y a pas encore de produits dans {category}.",
      thisCategory: 'cette catégorie',
      errorTitle: 'Produits indisponibles',
      resultCount: '{count} produits',
    },
    search: {
      label: 'Rechercher des produits',
      placeholder: 'Rechercher par mot-clé…',
    },
    filters: {
      statusLabel: 'Statut',
      visibilityLabel: 'Visibilité',
      sortLabel: 'Trier par',
      all: 'Tous',
      statusDraft: 'Brouillon',
      statusActive: 'Actif',
      statusInactive: 'Inactif',
      statusArchived: 'Archivé',
      visibilityVisible: 'Visible',
      visibilityHidden: 'Masqué',
      clearAll: 'Effacer tous les filtres',
    },
    sort: {
      default: 'Par défaut',
      nameAsc: 'Nom (A–Z)',
      nameDesc: 'Nom (Z–A)',
      newest: 'Plus récents',
      oldest: 'Plus anciens',
    },
    pagination: {
      label: 'Pages de produits',
      first: 'Première',
      previous: 'Précédent',
      next: 'Suivant',
      last: 'Dernier',
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
      noResultsTitle: 'Keine passenden Produkte',
      noResultsMessage: 'Versuchen Sie eine andere Suche oder entfernen Sie Filter.',
      noProductsTitle: 'Noch keine Produkte hier',
      noProductsMessage: 'Es gibt noch keine Produkte in {category}.',
      thisCategory: 'dieser Kategorie',
      errorTitle: 'Produkte nicht verfügbar',
      resultCount: '{count} Produkte',
    },
    search: {
      label: 'Produkte suchen',
      placeholder: 'Nach Stichwort suchen…',
    },
    filters: {
      statusLabel: 'Status',
      visibilityLabel: 'Sichtbarkeit',
      sortLabel: 'Sortieren nach',
      all: 'Alle',
      statusDraft: 'Entwurf',
      statusActive: 'Aktiv',
      statusInactive: 'Inaktiv',
      statusArchived: 'Archiviert',
      visibilityVisible: 'Sichtbar',
      visibilityHidden: 'Versteckt',
      clearAll: 'Alle Filter zurücksetzen',
    },
    sort: {
      default: 'Standard',
      nameAsc: 'Name (A–Z)',
      nameDesc: 'Name (Z–A)',
      newest: 'Neueste zuerst',
      oldest: 'Älteste zuerst',
    },
    pagination: {
      label: 'Produktseiten',
      first: 'Erste',
      previous: 'Zurück',
      next: 'Weiter',
      last: 'Letzte',
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
      noResultsTitle: 'Ningún producto coincide',
      noResultsMessage: 'Pruebe con otra búsqueda o quite algunos filtros.',
      noProductsTitle: 'Aún no hay productos aquí',
      noProductsMessage: 'Aún no hay productos en {category}.',
      thisCategory: 'esta categoría',
      errorTitle: 'Productos no disponibles',
      resultCount: '{count} productos',
    },
    search: {
      label: 'Buscar productos',
      placeholder: 'Buscar por palabra clave…',
    },
    filters: {
      statusLabel: 'Estado',
      visibilityLabel: 'Visibilidad',
      sortLabel: 'Ordenar por',
      all: 'Todos',
      statusDraft: 'Borrador',
      statusActive: 'Activo',
      statusInactive: 'Inactivo',
      statusArchived: 'Archivado',
      visibilityVisible: 'Visible',
      visibilityHidden: 'Oculto',
      clearAll: 'Borrar todos los filtros',
    },
    sort: {
      default: 'Predeterminado',
      nameAsc: 'Nombre (A–Z)',
      nameDesc: 'Nombre (Z–A)',
      newest: 'Más recientes',
      oldest: 'Más antiguos',
    },
    pagination: {
      label: 'Páginas de productos',
      first: 'Primera',
      previous: 'Anterior',
      next: 'Siguiente',
      last: 'Última',
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
      noResultsTitle: 'لا توجد منتجات مطابقة',
      noResultsMessage: 'جرّب بحثًا مختلفًا أو أزل بعض المرشحات.',
      noProductsTitle: 'لا توجد منتجات هنا بعد',
      noProductsMessage: 'لا توجد منتجات في {category} بعد.',
      thisCategory: 'هذه الفئة',
      errorTitle: 'المنتجات غير متاحة',
      resultCount: '{count} منتجات',
    },
    search: {
      label: 'البحث في المنتجات',
      placeholder: 'البحث بكلمة مفتاحية…',
    },
    filters: {
      statusLabel: 'الحالة',
      visibilityLabel: 'الظهور',
      sortLabel: 'ترتيب حسب',
      all: 'الكل',
      statusDraft: 'مسودة',
      statusActive: 'نشط',
      statusInactive: 'غير نشط',
      statusArchived: 'مؤرشف',
      visibilityVisible: 'مرئي',
      visibilityHidden: 'مخفي',
      clearAll: 'مسح عوامل التصفية',
    },
    sort: {
      default: 'الافتراضي',
      nameAsc: 'الاسم (أ–ي)',
      nameDesc: 'الاسم (ي–أ)',
      newest: 'الأحدث أولاً',
      oldest: 'الأقدم أولاً',
    },
    pagination: {
      label: 'صفحات المنتجات',
      first: 'الأولى',
      previous: 'السابق',
      next: 'التالي',
      last: 'الأخيرة',
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
