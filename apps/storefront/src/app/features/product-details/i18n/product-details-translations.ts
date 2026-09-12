/**
 * Storefront Product Details feature translations for Sub-Phase 6.2 — Page
 * & Information.
 *
 * Feature-owned, business-specific copy (`productDetails` namespace) in all
 * five supported cultures (`en`/`fr`/`de`/`es`/`ar`). Per the Phase 4
 * ownership rule (translation-model: features own their namespaces
 * alongside the feature — they must not add business keys to the base
 * resources), this bundle lives in the product-details feature and never
 * touches `libs/i18n` dictionaries.
 *
 * Lookup runs through the Phase 4 `translate` engine (deterministic
 * target → `en` → key-path fallback), resolved against the active
 * `CultureService.culture()` at the consuming component. Generic vocabulary
 * stays in the base resources — components resolve `common.actions.retry`
 * via `translateKey` and API failures via `resolveApiErrorMessage`, never
 * duplicating them here.
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

/** Product Details translation key paths owned by this feature (`productDetails.*`). */
export const PRODUCT_DETAILS_TRANSLATION_KEYS = {
  pageTitle: 'productDetails.page.title',
  pageLoading: 'productDetails.page.loading',
  pageErrorTitle: 'productDetails.page.errorTitle',
  invalidIdTitle: 'productDetails.invalidId.title',
  invalidIdMessage: 'productDetails.invalidId.message',
  notFoundTitle: 'productDetails.notFound.title',
  notFoundMessage: 'productDetails.notFound.message',
  notFoundBackToCatalog: 'productDetails.notFound.backToCatalog',
  descriptionTitle: 'productDetails.info.descriptionTitle',
  noDescription: 'productDetails.info.noDescription',
  specsTitle: 'productDetails.specs.title',
} as const;

/** English (`en`) product-details vocabulary. Also the deterministic fallback source. */
const EN_PRODUCT_DETAILS: TranslationDictionary = {
  productDetails: {
    page: {
      title: 'Product details',
      loading: 'Loading product…',
      errorTitle: 'Could not load the product',
    },
    invalidId: {
      title: 'Invalid product link',
      message: 'This product link is missing or invalid.',
    },
    notFound: {
      title: 'Product not found',
      message: 'This product does not exist or is no longer available.',
      backToCatalog: 'Back to catalog',
    },
    info: {
      descriptionTitle: 'Description',
      noDescription: 'No description available.',
    },
    specs: {
      title: 'Specifications',
    },
  },
};

/** French (`fr`) product-details vocabulary. */
const FR_PRODUCT_DETAILS: TranslationDictionary = {
  productDetails: {
    page: {
      title: 'Détails du produit',
      loading: 'Chargement du produit…',
      errorTitle: 'Impossible de charger le produit',
    },
    invalidId: {
      title: 'Lien produit invalide',
      message: 'Ce lien produit est manquant ou invalide.',
    },
    notFound: {
      title: 'Produit introuvable',
      message: "Ce produit n'existe pas ou n'est plus disponible.",
      backToCatalog: 'Retour au catalogue',
    },
    info: {
      descriptionTitle: 'Description',
      noDescription: 'Aucune description disponible.',
    },
    specs: {
      title: 'Caractéristiques',
    },
  },
};

/** German (`de`) product-details vocabulary. */
const DE_PRODUCT_DETAILS: TranslationDictionary = {
  productDetails: {
    page: {
      title: 'Produktdetails',
      loading: 'Produkt wird geladen…',
      errorTitle: 'Produkt konnte nicht geladen werden',
    },
    invalidId: {
      title: 'Ungültiger Produktlink',
      message: 'Dieser Produktlink fehlt oder ist ungültig.',
    },
    notFound: {
      title: 'Produkt nicht gefunden',
      message: 'Dieses Produkt existiert nicht oder ist nicht mehr verfügbar.',
      backToCatalog: 'Zurück zum Katalog',
    },
    info: {
      descriptionTitle: 'Beschreibung',
      noDescription: 'Keine Beschreibung verfügbar.',
    },
    specs: {
      title: 'Eigenschaften',
    },
  },
};

/** Spanish (`es`) product-details vocabulary. */
const ES_PRODUCT_DETAILS: TranslationDictionary = {
  productDetails: {
    page: {
      title: 'Detalles del producto',
      loading: 'Cargando el producto…',
      errorTitle: 'No se pudo cargar el producto',
    },
    invalidId: {
      title: 'Enlace de producto no válido',
      message: 'Este enlace de producto falta o no es válido.',
    },
    notFound: {
      title: 'Producto no encontrado',
      message: 'Este producto no existe o ya no está disponible.',
      backToCatalog: 'Volver al catálogo',
    },
    info: {
      descriptionTitle: 'Descripción',
      noDescription: 'No hay descripción disponible.',
    },
    specs: {
      title: 'Especificaciones',
    },
  },
};

/** Arabic (`ar`) product-details vocabulary. */
const AR_PRODUCT_DETAILS: TranslationDictionary = {
  productDetails: {
    page: {
      title: 'تفاصيل المنتج',
      loading: 'جارٍ تحميل المنتج…',
      errorTitle: 'تعذّر تحميل المنتج',
    },
    invalidId: {
      title: 'رابط المنتج غير صالح',
      message: 'رابط المنتج هذا مفقود أو غير صالح.',
    },
    notFound: {
      title: 'المنتج غير موجود',
      message: 'هذا المنتج غير موجود أو لم يعد متاحًا.',
      backToCatalog: 'العودة إلى الكتالوج',
    },
    info: {
      descriptionTitle: 'الوصف',
      noDescription: 'لا يتوفر وصف.',
    },
    specs: {
      title: 'المواصفات',
    },
  },
};

/** Bundled product-details dictionaries keyed by supported culture. */
export const PRODUCT_DETAILS_TRANSLATION_RESOURCES: TranslationResources = {
  en: EN_PRODUCT_DETAILS,
  fr: FR_PRODUCT_DETAILS,
  de: DE_PRODUCT_DETAILS,
  es: ES_PRODUCT_DETAILS,
  ar: AR_PRODUCT_DETAILS,
};

/**
 * Resolves a product-details key to its localized string with deterministic
 * fallback: target culture → `en` → the key path itself. `params` fills
 * `{placeholder}` slots. Never throws.
 */
export function translateProductDetailsKey(
  culture: Culture,
  key: string,
  params: TranslationParams = {},
): string {
  return translate(PRODUCT_DETAILS_TRANSLATION_RESOURCES, culture, key, params);
}
