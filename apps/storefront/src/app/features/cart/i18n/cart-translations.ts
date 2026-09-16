/**
 * Storefront Cart feature translations for Sub-Phase 7.4 — Cart Page & UI.
 *
 * Feature-owned, business-specific copy (`cart` namespace) in all five
 * supported cultures (`en`/`fr`/`de`/`es`/`ar`). Per the Phase 4 ownership
 * rule (translation-model: features own their namespaces alongside the
 * feature — they must not add business keys to the base resources), this
 * bundle lives in the cart feature and never touches `libs/i18n`
 * dictionaries.
 *
 * Lookup runs through the Phase 4 `translate` engine (deterministic
 * target → `en` → key-path fallback, `{param}` interpolation), resolved
 * against the active `CultureService.culture()` at the consuming page.
 * Generic vocabulary stays in the base resources — the page resolves
 * `common.actions.retry` via `translateKey` and API failures via
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

/** Cart translation key paths owned by this feature (`cart.*`). */
export const CART_TRANSLATION_KEYS = {
  pageTitle: 'cart.page.title',
  pageLoading: 'cart.page.loading',
  pageStandby: 'cart.page.standby',
  pageErrorTitle: 'cart.page.errorTitle',
  pageEmptyTitle: 'cart.page.emptyTitle',
  pageEmptyMessage: 'cart.page.emptyMessage',
  pageBrowseCatalog: 'cart.page.browseCatalog',
  itemsTitle: 'cart.items.title',
  itemUnitPrice: 'cart.item.unitPrice',
  itemSku: 'cart.item.sku',
  itemQuantity: 'cart.item.quantity',
  itemDecrease: 'cart.item.decrease',
  itemIncrease: 'cart.item.increase',
  itemInvalidQuantity: 'cart.item.invalidQuantity',
  itemRemove: 'cart.item.remove',
  summaryTitle: 'cart.summary.title',
  summaryItemsLabel: 'cart.summary.itemsLabel',
  summarySubtotal: 'cart.summary.subtotal',
  summaryTotal: 'cart.summary.total',
  summaryTotalsPending: 'cart.summary.totalsPending',
  summaryClear: 'cart.summary.clear',
  summaryCheckout: 'cart.summary.checkout',
  statusQuantityUpdated: 'cart.status.quantityUpdated',
  statusItemRemoved: 'cart.status.itemRemoved',
  statusCartCleared: 'cart.status.cartCleared',
} as const;

/** English (`en`) cart vocabulary. Also the deterministic fallback source. */
const EN_CART: TranslationDictionary = {
  cart: {
    page: {
      title: 'Your cart',
      loading: 'Loading your cart…',
      standby: 'Your cart will appear here.',
      errorTitle: 'Cart unavailable',
      emptyTitle: 'Your cart is empty',
      emptyMessage: 'Browse the catalog and add something you like.',
      browseCatalog: 'Browse the catalog',
    },
    items: {
      title: 'Cart items',
    },
    item: {
      unitPrice: 'Unit price',
      sku: 'SKU',
      quantity: 'Quantity',
      decrease: 'Decrease quantity',
      increase: 'Increase quantity',
      invalidQuantity: 'Enter a whole number of 1 or more.',
      remove: 'Remove {product}',
    },
    summary: {
      title: 'Order summary',
      itemsLabel: 'Items',
      subtotal: 'Subtotal',
      total: 'Total',
      totalsPending: 'Totals are finalized at checkout.',
      clear: 'Clear cart',
      checkout: 'Proceed to checkout',
    },
    status: {
      quantityUpdated: 'Quantity updated.',
      itemRemoved: 'Item removed from your cart.',
      cartCleared: 'Your cart was cleared.',
    },
  },
};

/** French (`fr`) cart vocabulary. */
const FR_CART: TranslationDictionary = {
  cart: {
    page: {
      title: 'Votre panier',
      loading: 'Chargement de votre panier…',
      standby: 'Votre panier apparaîtra ici.',
      errorTitle: 'Panier indisponible',
      emptyTitle: 'Votre panier est vide',
      emptyMessage: 'Parcourez le catalogue et ajoutez ce qui vous plaît.',
      browseCatalog: 'Parcourir le catalogue',
    },
    items: {
      title: 'Articles du panier',
    },
    item: {
      unitPrice: 'Prix unitaire',
      sku: 'SKU',
      quantity: 'Quantité',
      decrease: 'Diminuer la quantité',
      increase: 'Augmenter la quantité',
      invalidQuantity: 'Saisissez un nombre entier de 1 ou plus.',
      remove: 'Retirer {product}',
    },
    summary: {
      title: 'Récapitulatif',
      itemsLabel: 'Articles',
      subtotal: 'Sous-total',
      total: 'Total',
      totalsPending: 'Les totaux sont finalisés à la commande.',
      clear: 'Vider le panier',
      checkout: 'Passer commande',
    },
    status: {
      quantityUpdated: 'Quantité mise à jour.',
      itemRemoved: 'Article retiré de votre panier.',
      cartCleared: 'Votre panier a été vidé.',
    },
  },
};

/** German (`de`) cart vocabulary. */
const DE_CART: TranslationDictionary = {
  cart: {
    page: {
      title: 'Ihr Warenkorb',
      loading: 'Ihr Warenkorb wird geladen…',
      standby: 'Ihr Warenkorb erscheint hier.',
      errorTitle: 'Warenkorb nicht verfügbar',
      emptyTitle: 'Ihr Warenkorb ist leer',
      emptyMessage: 'Stöbern Sie im Katalog und legen Sie etwas in den Warenkorb.',
      browseCatalog: 'Katalog durchsuchen',
    },
    items: {
      title: 'Warenkorbpositionen',
    },
    item: {
      unitPrice: 'Stückpreis',
      sku: 'SKU',
      quantity: 'Menge',
      decrease: 'Menge verringern',
      increase: 'Menge erhöhen',
      invalidQuantity: 'Geben Sie eine ganze Zahl von 1 oder mehr ein.',
      remove: '{product} entfernen',
    },
    summary: {
      title: 'Bestellübersicht',
      itemsLabel: 'Artikel',
      subtotal: 'Zwischensumme',
      total: 'Gesamt',
      totalsPending: 'Die Summen werden an der Kasse finalisiert.',
      clear: 'Warenkorb leeren',
      checkout: 'Zur Kasse',
    },
    status: {
      quantityUpdated: 'Menge aktualisiert.',
      itemRemoved: 'Artikel aus Ihrem Warenkorb entfernt.',
      cartCleared: 'Ihr Warenkorb wurde geleert.',
    },
  },
};

/** Spanish (`es`) cart vocabulary. */
const ES_CART: TranslationDictionary = {
  cart: {
    page: {
      title: 'Tu cesta',
      loading: 'Cargando tu cesta…',
      standby: 'Tu cesta aparecerá aquí.',
      errorTitle: 'Cesta no disponible',
      emptyTitle: 'Tu cesta está vacía',
      emptyMessage: 'Explora el catálogo y añade lo que te guste.',
      browseCatalog: 'Explorar el catálogo',
    },
    items: {
      title: 'Artículos de la cesta',
    },
    item: {
      unitPrice: 'Precio unitario',
      sku: 'SKU',
      quantity: 'Cantidad',
      decrease: 'Disminuir cantidad',
      increase: 'Aumentar cantidad',
      invalidQuantity: 'Introduce un número entero de 1 o más.',
      remove: 'Quitar {product}',
    },
    summary: {
      title: 'Resumen del pedido',
      itemsLabel: 'Artículos',
      subtotal: 'Subtotal',
      total: 'Total',
      totalsPending: 'Los totales se confirman al pagar.',
      clear: 'Vaciar la cesta',
      checkout: 'Tramitar pedido',
    },
    status: {
      quantityUpdated: 'Cantidad actualizada.',
      itemRemoved: 'Artículo eliminado de tu cesta.',
      cartCleared: 'Tu cesta se ha vaciado.',
    },
  },
};

/** Arabic (`ar`) cart vocabulary. */
const AR_CART: TranslationDictionary = {
  cart: {
    page: {
      title: 'سلة التسوق',
      loading: 'جارٍ تحميل سلة التسوق…',
      standby: 'ستظهر سلة التسوق هنا.',
      errorTitle: 'السلة غير متاحة',
      emptyTitle: 'سلة التسوق فارغة',
      emptyMessage: 'تصفح الكتالوج وأضف ما يعجبك.',
      browseCatalog: 'تصفح الكتالوج',
    },
    items: {
      title: 'منتجات السلة',
    },
    item: {
      unitPrice: 'سعر الوحدة',
      sku: 'SKU',
      quantity: 'الكمية',
      decrease: 'إنقاص الكمية',
      increase: 'زيادة الكمية',
      invalidQuantity: 'أدخل عددًا صحيحًا من 1 أو أكثر.',
      remove: 'إزالة {product}',
    },
    summary: {
      title: 'ملخص الطلب',
      itemsLabel: 'المنتجات',
      subtotal: 'المجموع الفرعي',
      total: 'الإجمالي',
      totalsPending: 'تُحسم المجاميع عند إتمام الطلب.',
      clear: 'إفراغ السلة',
      checkout: 'إتمام الطلب',
    },
    status: {
      quantityUpdated: 'تم تحديث الكمية.',
      itemRemoved: 'تمت إزالة المنتج من سلة التسوق.',
      cartCleared: 'تم إفراغ سلة التسوق.',
    },
  },
};

/** Bundled cart dictionaries keyed by supported culture. */
export const CART_TRANSLATION_RESOURCES: TranslationResources = {
  en: EN_CART,
  fr: FR_CART,
  de: DE_CART,
  es: ES_CART,
  ar: AR_CART,
};

/**
 * Resolves a cart key to its localized string with deterministic
 * fallback: target culture → `en` → the key path itself. `params` fills
 * `{placeholder}` slots (e.g. `{count}`, `{product}`). Never throws.
 */
export function translateCartKey(
  culture: Culture,
  key: string,
  params: TranslationParams = {},
): string {
  return translate(CART_TRANSLATION_RESOURCES, culture, key, params);
}
