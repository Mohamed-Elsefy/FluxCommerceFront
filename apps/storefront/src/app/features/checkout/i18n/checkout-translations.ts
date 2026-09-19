/**
 * Storefront Checkout feature translations for Sub-Phases 8.4 (Customer
 * & Shipping Information) and 8.5 (Order Summary).
 *
 * Feature-owned, business-specific copy (`checkout` namespace) in all
 * five supported cultures (`en`/`fr`/`de`/`es`/`ar`). Per the Phase 4
 * ownership rule (translation-model: features own their namespaces
 * alongside the feature — they must not add business keys to the base
 * resources), this bundle lives in the checkout feature and never
 * touches `libs/i18n` dictionaries.
 *
 * Lookup runs through the Phase 4 `translate` engine (deterministic
 * target → `en` → key-path fallback, `{param}` interpolation), resolved
 * against the active `CultureService.culture()` at the consuming page
 * (8.6+). Validation templates carry `{label}`/`{max}` slots filled by
 * the checkout field-errors component. Generic vocabulary stays in the
 * base resources.
 *
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

/** Checkout translation key paths owned by this feature (`checkout.*`). */
export const CHECKOUT_TRANSLATION_KEYS = {
  sectionsShipping: 'checkout.sections.shipping',
  sectionsBilling: 'checkout.sections.billing',
  fieldsRecipientName: 'checkout.fields.recipientName',
  fieldsLine1: 'checkout.fields.line1',
  fieldsLine2: 'checkout.fields.line2',
  fieldsLine2Optional: 'checkout.fields.line2Optional',
  fieldsCity: 'checkout.fields.city',
  fieldsRegion: 'checkout.fields.region',
  fieldsPostalCode: 'checkout.fields.postalCode',
  fieldsCountryCode: 'checkout.fields.countryCode',
  billingSameAsShipping: 'checkout.billingSameAsShipping',
  submit: 'checkout.submit',
  validationRequired: 'checkout.validation.required',
  validationTooLong: 'checkout.validation.tooLong',
  validationInvalidCountryCode: 'checkout.validation.invalidCountryCode',
  summaryTitle: 'checkout.summary.title',
  summaryItems: 'checkout.summary.items',
  summaryEmptyTitle: 'checkout.summary.emptyTitle',
  summaryEmptyMessage: 'checkout.summary.emptyMessage',
  summaryQuantity: 'checkout.summary.quantity',
  summaryUnitPrice: 'checkout.summary.unitPrice',
  summarySku: 'checkout.summary.sku',
  summarySubtotal: 'checkout.summary.subtotal',
  summaryShippingCost: 'checkout.summary.shippingCost',
  summaryDiscount: 'checkout.summary.discount',
  summaryGrandTotal: 'checkout.summary.grandTotal',
  summaryTotalsPending: 'checkout.summary.totalsPending',
  pageTitle: 'checkout.page.title',
  pageLoading: 'checkout.page.loading',
  pageLoadErrorTitle: 'checkout.page.loadErrorTitle',
  pageEmptyTitle: 'checkout.page.emptyTitle',
  pageEmptyMessage: 'checkout.page.emptyMessage',
  pageBackToCart: 'checkout.page.backToCart',
  pageSuccessTitle: 'checkout.page.successTitle',
  pageContinueToPayment: 'checkout.page.continueToPayment',
  pageOrderNumber: 'checkout.page.orderNumber',
  pageOrderStatus: 'checkout.page.orderStatus',
  pageSubmitErrorTitle: 'checkout.page.submitErrorTitle',
} as const;

/** English (`en`) checkout vocabulary. Also the deterministic fallback source. */
const EN_CHECKOUT: TranslationDictionary = {
  checkout: {
    sections: {
      shipping: 'Shipping address',
      billing: 'Billing address',
    },
    fields: {
      recipientName: 'Full name',
      line1: 'Street address',
      line2: 'Apartment, suite, etc.',
      line2Optional: 'Optional',
      city: 'City',
      region: 'State / Region',
      postalCode: 'Postal code',
      countryCode: 'Country code',
    },
    billingSameAsShipping: 'Billing address is the same as shipping',
    submit: 'Continue',
    page: {
      title: 'Checkout',
      loading: 'Loading checkout…',
      loadErrorTitle: 'Checkout unavailable',
      emptyTitle: 'Your cart is empty',
      emptyMessage: 'Add items to your cart before checking out.',
      backToCart: 'Back to cart',
      successTitle: 'Order created',
      continueToPayment: 'Continue to payment',
      orderNumber: 'Order number',
      orderStatus: 'Status',
      submitErrorTitle: 'Order creation failed',
    },
    validation: {
      required: '{label} is required.',
      tooLong: '{label} must be no more than {max} characters.',
      invalidCountryCode: '{label} must be 2 uppercase letters (e.g. DE).',
    },
    summary: {
      title: 'Order summary',
      items: 'Items',
      emptyTitle: 'Nothing to review',
      emptyMessage: 'Your cart is empty.',
      quantity: 'Quantity',
      unitPrice: 'Unit price',
      sku: 'SKU',
      subtotal: 'Subtotal',
      shippingCost: 'Shipping',
      discount: 'Discount',
      grandTotal: 'Total',
      totalsPending: 'Totals are finalized when your order is created.',
    },
  },
};

/** French (`fr`) checkout vocabulary. */
const FR_CHECKOUT: TranslationDictionary = {
  checkout: {
    sections: {
      shipping: 'Adresse de livraison',
      billing: 'Adresse de facturation',
    },
    fields: {
      recipientName: 'Nom complet',
      line1: 'Adresse',
      line2: 'Appartement, suite, etc.',
      line2Optional: 'Facultatif',
      city: 'Ville',
      region: 'Région',
      postalCode: 'Code postal',
      countryCode: 'Code pays',
    },
    billingSameAsShipping: 'L’adresse de facturation est identique à l’adresse de livraison',
    submit: 'Continuer',
    page: {
      title: 'Commande',
      loading: 'Chargement de la commande…',
      loadErrorTitle: 'Commande indisponible',
      emptyTitle: 'Votre panier est vide',
      emptyMessage: 'Ajoutez des articles à votre panier avant de commander.',
      backToCart: 'Retour au panier',
      successTitle: 'Commande créée',
      continueToPayment: 'Continuer vers le paiement',
      orderNumber: 'Numéro de commande',
      orderStatus: 'Statut',
      submitErrorTitle: 'Échec de la création de commande',
    },
    validation: {
      required: '{label} est obligatoire.',
      tooLong: '{label} doit comporter au maximum {max} caractères.',
      invalidCountryCode: '{label} doit comporter 2 lettres majuscules (ex. DE).',
    },
    summary: {
      title: 'Récapitulatif de commande',
      items: 'Articles',
      emptyTitle: 'Rien à vérifier',
      emptyMessage: 'Votre panier est vide.',
      quantity: 'Quantité',
      unitPrice: 'Prix unitaire',
      sku: 'SKU',
      subtotal: 'Sous-total',
      shippingCost: 'Livraison',
      discount: 'Remise',
      grandTotal: 'Total',
      totalsPending: 'Les totaux sont finalisés à la création de la commande.',
    },
  },
};

/** German (`de`) checkout vocabulary. */
const DE_CHECKOUT: TranslationDictionary = {
  checkout: {
    sections: {
      shipping: 'Lieferadresse',
      billing: 'Rechnungsadresse',
    },
    fields: {
      recipientName: 'Vollständiger Name',
      line1: 'Straße und Hausnummer',
      line2: 'Wohnung, Suite usw.',
      line2Optional: 'Optional',
      city: 'Stadt',
      region: 'Bundesland / Region',
      postalCode: 'Postleitzahl',
      countryCode: 'Ländercode',
    },
    billingSameAsShipping: 'Rechnungsadresse entspricht der Lieferadresse',
    submit: 'Weiter',
    page: {
      title: 'Kasse',
      loading: 'Kasse wird geladen…',
      loadErrorTitle: 'Kasse nicht verfügbar',
      emptyTitle: 'Ihr Warenkorb ist leer',
      emptyMessage: 'Legen Sie Artikel in den Warenkorb, bevor Sie zur Kasse gehen.',
      backToCart: 'Zurück zum Warenkorb',
      successTitle: 'Bestellung erstellt',
      continueToPayment: 'Weiter zur Zahlung',
      orderNumber: 'Bestellnummer',
      orderStatus: 'Status',
      submitErrorTitle: 'Bestellerstellung fehlgeschlagen',
    },
    validation: {
      required: '{label} ist erforderlich.',
      tooLong: '{label} darf höchstens {max} Zeichen lang sein.',
      invalidCountryCode: '{label} muss aus 2 Großbuchstaben bestehen (z. B. DE).',
    },
    summary: {
      title: 'Bestellübersicht',
      items: 'Artikel',
      emptyTitle: 'Nichts zu prüfen',
      emptyMessage: 'Ihr Warenkorb ist leer.',
      quantity: 'Menge',
      unitPrice: 'Stückpreis',
      sku: 'SKU',
      subtotal: 'Zwischensumme',
      shippingCost: 'Versand',
      discount: 'Rabatt',
      grandTotal: 'Gesamt',
      totalsPending: 'Die Summen werden bei der Bestellerstellung finalisiert.',
    },
  },
};

/** Spanish (`es`) checkout vocabulary. */
const ES_CHECKOUT: TranslationDictionary = {
  checkout: {
    sections: {
      shipping: 'Dirección de envío',
      billing: 'Dirección de facturación',
    },
    fields: {
      recipientName: 'Nombre completo',
      line1: 'Dirección',
      line2: 'Apartamento, suite, etc.',
      line2Optional: 'Opcional',
      city: 'Ciudad',
      region: 'Provincia / Región',
      postalCode: 'Código postal',
      countryCode: 'Código de país',
    },
    billingSameAsShipping: 'La dirección de facturación es igual a la de envío',
    submit: 'Continuar',
    page: {
      title: 'Tramitar el pedido',
      loading: 'Cargando el pedido…',
      loadErrorTitle: 'Pedido no disponible',
      emptyTitle: 'Tu cesta está vacía',
      emptyMessage: 'Añade artículos a tu cesta antes de tramitar el pedido.',
      backToCart: 'Volver a la cesta',
      successTitle: 'Pedido creado',
      continueToPayment: 'Continuar al pago',
      orderNumber: 'Número de pedido',
      orderStatus: 'Estado',
      submitErrorTitle: 'Error al crear el pedido',
    },
    validation: {
      required: '{label} es obligatorio.',
      tooLong: '{label} debe tener como máximo {max} caracteres.',
      invalidCountryCode: '{label} debe tener 2 letras mayúsculas (p. ej., DE).',
    },
    summary: {
      title: 'Resumen del pedido',
      items: 'Artículos',
      emptyTitle: 'Nada que revisar',
      emptyMessage: 'Tu cesta está vacía.',
      quantity: 'Cantidad',
      unitPrice: 'Precio unitario',
      sku: 'SKU',
      subtotal: 'Subtotal',
      shippingCost: 'Envío',
      discount: 'Descuento',
      grandTotal: 'Total',
      totalsPending: 'Los totales se confirman al crear el pedido.',
    },
  },
};

/** Arabic (`ar`) checkout vocabulary. */
const AR_CHECKOUT: TranslationDictionary = {
  checkout: {
    sections: {
      shipping: 'عنوان الشحن',
      billing: 'عنوان الفوترة',
    },
    fields: {
      recipientName: 'الاسم الكامل',
      line1: 'عنوان الشارع',
      line2: 'شقة، جناح، إلخ.',
      line2Optional: 'اختياري',
      city: 'المدينة',
      region: 'الولاية / المنطقة',
      postalCode: 'الرمز البريدي',
      countryCode: 'رمز البلد',
    },
    billingSameAsShipping: 'عنوان الفوترة هو نفس عنوان الشحن',
    submit: 'متابعة',
    page: {
      title: 'إتمام الطلب',
      loading: 'جارٍ تحميل إتمام الطلب…',
      loadErrorTitle: 'إتمام الطلب غير متاح',
      emptyTitle: 'سلة التسوق فارغة',
      emptyMessage: 'أضف منتجات إلى السلة قبل إتمام الطلب.',
      backToCart: 'العودة إلى السلة',
      successTitle: 'تم إنشاء الطلب',
      continueToPayment: 'المتابعة إلى الدفع',
      orderNumber: 'رقم الطلب',
      orderStatus: 'الحالة',
      submitErrorTitle: 'فشل إنشاء الطلب',
    },
    validation: {
      required: '{label} مطلوب.',
      tooLong: 'يجب ألا يتجاوز {label} {max} من الأحرف.',
      invalidCountryCode: 'يجب أن يتكون {label} من حرفين كبيرين (مثال: DE).',
    },
    summary: {
      title: 'ملخص الطلب',
      items: 'المنتجات',
      emptyTitle: 'لا شيء للمراجعة',
      emptyMessage: 'سلة التسوق فارغة.',
      quantity: 'الكمية',
      unitPrice: 'سعر الوحدة',
      sku: 'SKU',
      subtotal: 'المجموع الفرعي',
      shippingCost: 'الشحن',
      discount: 'الخصم',
      grandTotal: 'الإجمالي',
      totalsPending: 'تُحسم المجاميع عند إنشاء الطلب.',
    },
  },
};

/** Bundled checkout dictionaries keyed by supported culture. */
export const CHECKOUT_TRANSLATION_RESOURCES: TranslationResources = {
  en: EN_CHECKOUT,
  fr: FR_CHECKOUT,
  de: DE_CHECKOUT,
  es: ES_CHECKOUT,
  ar: AR_CHECKOUT,
};

/**
 * Resolves a checkout key to its localized string with deterministic
 * fallback: target culture → `en` → the key path itself. `params` fills
 * `{placeholder}` slots (e.g. `{label}`, `{max}`). Never throws.
 */
export function translateCheckoutKey(
  culture: Culture,
  key: string,
  params: TranslationParams = {},
): string {
  return translate(CHECKOUT_TRANSLATION_RESOURCES, culture, key, params);
}
