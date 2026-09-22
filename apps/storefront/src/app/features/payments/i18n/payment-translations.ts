/**
 * Storefront Payments feature translations for Sub-Phase 9.10 —
 * Payment UI & Checkout Integration.
 *
 * Feature-owned, business-specific copy (`payment` namespace) in all
 * five supported cultures (`en`/`fr`/`de`/`es`/`ar`). Per the Phase 4
 * ownership rule (translation-model: features own their namespaces
 * alongside the feature — they must not add business keys to the base
 * resources), this bundle lives in the payments feature and never
 * touches `libs/i18n` dictionaries.
 *
 * Lookup runs through the Phase 4 `translate` engine (deterministic
 * target → `en` → key-path fallback, `{param}` interpolation), resolved
 * against the active `CultureService.culture()` at the consuming page.
 * Generic vocabulary (retry actions, generic errors) stays in the base
 * resources and is referenced via `translateKey`, never duplicated here.
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

/** Payment translation key paths owned by this feature (`payment.*`). */
export const PAYMENT_TRANSLATION_KEYS = {
  pageTitle: 'payment.page.title',
  pageResultTitle: 'payment.page.resultTitle',
  pageOrderLabel: 'payment.page.orderLabel',
  pageMissingReference: 'payment.page.missingReference',
  formTitle: 'payment.form.title',
  formPlaceholder: 'payment.form.placeholder',
  formSubmit: 'payment.form.submit',
  statusWaiting: 'payment.status.waiting',
  loadingLabel: 'payment.loading.label',
  resultSuccessTitle: 'payment.result.successTitle',
  resultOrderReference: 'payment.result.orderReference',
  resultVerifiedStatus: 'payment.result.verifiedStatus',
  resultFailureTitle: 'payment.result.failureTitle',
  resultCancelledTitle: 'payment.result.cancelledTitle',
  resultCancelledMessage: 'payment.result.cancelledMessage',
  resultPendingTitle: 'payment.result.pendingTitle',
  resultPendingMessage: 'payment.result.pendingMessage',
  resultUnknownTitle: 'payment.result.unknownTitle',
  resultUnknownMessage: 'payment.result.unknownMessage',
  resultTryAgain: 'payment.result.tryAgain',
  resultBackToCheckout: 'payment.result.backToCheckout',
  resultBackToPayment: 'payment.result.backToPayment',
  resultWaitingMessage: 'payment.result.waitingMessage',
  resultCheckStatus: 'payment.result.checkStatus',
  resultViewOrder: 'payment.result.viewOrder',
  errorUnavailable: 'payment.errors.unavailable',
  errorSetupFailed: 'payment.errors.setupFailed',
  errorDeclinedFallback: 'payment.errors.declinedFallback',
  errorVerificationFailed: 'payment.errors.verificationFailed',
  errorNotFound: 'payment.errors.notFound',
  summaryTitle: 'payment.summary.title',
  summaryItems: 'payment.summary.items',
  summaryQuantity: 'payment.summary.quantity',
  summaryUnitPrice: 'payment.summary.unitPrice',
  summarySku: 'payment.summary.sku',
  summaryOrderNumber: 'payment.summary.orderNumber',
  summarySubtotal: 'payment.summary.subtotal',
  summaryShippingCost: 'payment.summary.shippingCost',
  summaryDiscount: 'payment.summary.discount',
  summaryGrandTotal: 'payment.summary.grandTotal',
} as const;

/** English (`en`) payment vocabulary. Also the deterministic fallback source. */
const EN_PAYMENT: TranslationDictionary = {
  payment: {
    page: {
      title: 'Payment',
      resultTitle: 'Payment result',
      orderLabel: 'Order {orderId}',
      missingReference: 'Order reference is missing.',
    },
    form: {
      title: 'Payment details',
      placeholder: 'Secure payment form loads here.',
      submit: 'Pay',
    },
    status: {
      waiting: 'Waiting for payment…',
    },
    loading: {
      label: 'Loading payment…',
    },
    result: {
      successTitle: 'Payment successful',
      orderReference: 'Order reference',
      verifiedStatus: 'Verified status',
      failureTitle: 'Payment failed',
      cancelledTitle: 'Payment cancelled',
      cancelledMessage: 'No charge was made.',
      pendingTitle: 'Payment pending',
      pendingMessage: 'Your payment is being verified.',
      unknownTitle: 'Payment status unknown',
      unknownMessage:
        'We could not confirm your payment. Check the backend status before trying again — do not resubmit.',
      tryAgain: 'Try again',
      backToCheckout: 'Back to checkout',
      backToPayment: 'Back to payment',
      waitingMessage: 'No payment result yet.',
      checkStatus: 'Check status',
      viewOrder: 'View order',
    },
    errors: {
      unavailable: 'Payment is currently unavailable. Please try again.',
      setupFailed: 'Payment setup failed. Please try again.',
      declinedFallback: 'Payment was declined.',
      verificationFailed: 'The backend reports the payment as failed.',
      notFound: 'Payment not found.',
    },
    summary: {
      title: 'Order summary',
      items: 'Items',
      quantity: 'Quantity',
      unitPrice: 'Unit price',
      sku: 'SKU',
      orderNumber: 'Order number',
      subtotal: 'Subtotal',
      shippingCost: 'Shipping',
      discount: 'Discount',
      grandTotal: 'Total',
    },
  },
};

/** French (`fr`) payment vocabulary. */
const FR_PAYMENT: TranslationDictionary = {
  payment: {
    page: {
      title: 'Paiement',
      resultTitle: 'Résultat du paiement',
      orderLabel: 'Commande {orderId}',
      missingReference: 'Référence de commande manquante.',
    },
    form: {
      title: 'Détails du paiement',
      placeholder: 'Le formulaire de paiement sécurisé se charge ici.',
      submit: 'Payer',
    },
    status: {
      waiting: 'En attente du paiement…',
    },
    loading: {
      label: 'Chargement du paiement…',
    },
    result: {
      successTitle: 'Paiement réussi',
      orderReference: 'Référence de commande',
      verifiedStatus: 'Statut vérifié',
      failureTitle: 'Échec du paiement',
      cancelledTitle: 'Paiement annulé',
      cancelledMessage: 'Aucun montant n’a été débité.',
      pendingTitle: 'Paiement en attente',
      pendingMessage: 'Votre paiement est en cours de vérification.',
      unknownTitle: 'Statut du paiement inconnu',
      unknownMessage:
        'Nous n’avons pas pu confirmer votre paiement. Vérifiez le statut avant de réessayer — ne renvoyez pas le formulaire.',
      tryAgain: 'Réessayer',
      backToCheckout: 'Retour à la commande',
      backToPayment: 'Retour au paiement',
      waitingMessage: 'Aucun résultat de paiement pour le moment.',
      checkStatus: 'Vérifier le statut',
      viewOrder: 'Voir la commande',
    },
    errors: {
      unavailable: 'Le paiement est momentanément indisponible. Veuillez réessayer.',
      setupFailed: 'La préparation du paiement a échoué. Veuillez réessayer.',
      declinedFallback: 'Le paiement a été refusé.',
      verificationFailed: 'Le backend signale le paiement comme échoué.',
      notFound: 'Paiement introuvable.',
    },
    summary: {
      title: 'Récapitulatif de commande',
      items: 'Articles',
      quantity: 'Quantité',
      unitPrice: 'Prix unitaire',
      sku: 'SKU',
      orderNumber: 'Numéro de commande',
      subtotal: 'Sous-total',
      shippingCost: 'Livraison',
      discount: 'Remise',
      grandTotal: 'Total',
    },
  },
};

/** German (`de`) payment vocabulary. */
const DE_PAYMENT: TranslationDictionary = {
  payment: {
    page: {
      title: 'Zahlung',
      resultTitle: 'Zahlungsergebnis',
      orderLabel: 'Bestellung {orderId}',
      missingReference: 'Bestellreferenz fehlt.',
    },
    form: {
      title: 'Zahlungsdetails',
      placeholder: 'Sicheres Zahlungsformular wird hier geladen.',
      submit: 'Zahlen',
    },
    status: {
      waiting: 'Warten auf Zahlung…',
    },
    loading: {
      label: 'Zahlung wird geladen…',
    },
    result: {
      successTitle: 'Zahlung erfolgreich',
      orderReference: 'Bestellreferenz',
      verifiedStatus: 'Verifizierter Status',
      failureTitle: 'Zahlung fehlgeschlagen',
      cancelledTitle: 'Zahlung abgebrochen',
      cancelledMessage: 'Es wurde nichts abgebucht.',
      pendingTitle: 'Zahlung ausstehend',
      pendingMessage: 'Ihre Zahlung wird überprüft.',
      unknownTitle: 'Zahlungsstatus unbekannt',
      unknownMessage:
        'Ihre Zahlung konnte nicht bestätigt werden. Prüfen Sie den Status, bevor Sie es erneut versuchen — senden Sie das Formular nicht erneut ab.',
      tryAgain: 'Erneut versuchen',
      backToCheckout: 'Zurück zur Kasse',
      backToPayment: 'Zurück zur Zahlung',
      waitingMessage: 'Noch kein Zahlungsergebnis.',
      checkStatus: 'Status prüfen',
      viewOrder: 'Bestellung ansehen',
    },
    errors: {
      unavailable: 'Die Zahlung ist derzeit nicht verfügbar. Bitte versuchen Sie es erneut.',
      setupFailed: 'Die Zahlungsvorbereitung ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
      declinedFallback: 'Die Zahlung wurde abgelehnt.',
      verificationFailed: 'Das Backend meldet die Zahlung als fehlgeschlagen.',
      notFound: 'Zahlung nicht gefunden.',
    },
    summary: {
      title: 'Bestellübersicht',
      items: 'Artikel',
      quantity: 'Menge',
      unitPrice: 'Stückpreis',
      sku: 'SKU',
      orderNumber: 'Bestellnummer',
      subtotal: 'Zwischensumme',
      shippingCost: 'Versand',
      discount: 'Rabatt',
      grandTotal: 'Gesamt',
    },
  },
};

/** Spanish (`es`) payment vocabulary. */
const ES_PAYMENT: TranslationDictionary = {
  payment: {
    page: {
      title: 'Pago',
      resultTitle: 'Resultado del pago',
      orderLabel: 'Pedido {orderId}',
      missingReference: 'Falta la referencia del pedido.',
    },
    form: {
      title: 'Detalles del pago',
      placeholder: 'El formulario de pago seguro se carga aquí.',
      submit: 'Pagar',
    },
    status: {
      waiting: 'Esperando el pago…',
    },
    loading: {
      label: 'Cargando el pago…',
    },
    result: {
      successTitle: 'Pago realizado',
      orderReference: 'Referencia del pedido',
      verifiedStatus: 'Estado verificado',
      failureTitle: 'Error en el pago',
      cancelledTitle: 'Pago cancelado',
      cancelledMessage: 'No se ha realizado ningún cargo.',
      pendingTitle: 'Pago pendiente',
      pendingMessage: 'Su pago se está verificando.',
      unknownTitle: 'Estado del pago desconocido',
      unknownMessage:
        'No hemos podido confirmar su pago. Compruebe el estado antes de intentarlo de nuevo — no vuelva a enviar el formulario.',
      tryAgain: 'Intentarlo de nuevo',
      backToCheckout: 'Volver al pedido',
      backToPayment: 'Volver al pago',
      waitingMessage: 'Aún no hay resultado del pago.',
      checkStatus: 'Comprobar estado',
      viewOrder: 'Ver el pedido',
    },
    errors: {
      unavailable: 'El pago no está disponible en este momento. Inténtelo de nuevo.',
      setupFailed: 'La preparación del pago ha fallado. Inténtelo de nuevo.',
      declinedFallback: 'El pago ha sido rechazado.',
      verificationFailed: 'El backend informa del pago como fallido.',
      notFound: 'Pago no encontrado.',
    },
    summary: {
      title: 'Resumen del pedido',
      items: 'Artículos',
      quantity: 'Cantidad',
      unitPrice: 'Precio unitario',
      sku: 'SKU',
      orderNumber: 'Número de pedido',
      subtotal: 'Subtotal',
      shippingCost: 'Envío',
      discount: 'Descuento',
      grandTotal: 'Total',
    },
  },
};

/** Arabic (`ar`) payment vocabulary. */
const AR_PAYMENT: TranslationDictionary = {
  payment: {
    page: {
      title: 'الدفع',
      resultTitle: 'نتيجة الدفع',
      orderLabel: 'الطلب {orderId}',
      missingReference: 'مرجع الطلب مفقود.',
    },
    form: {
      title: 'تفاصيل الدفع',
      placeholder: 'يتم تحميل نموذج الدفع الآمن هنا.',
      submit: 'ادفع',
    },
    status: {
      waiting: 'بانتظار الدفع…',
    },
    loading: {
      label: 'جارٍ تحميل الدفع…',
    },
    result: {
      successTitle: 'تم الدفع بنجاح',
      orderReference: 'مرجع الطلب',
      verifiedStatus: 'الحالة المؤكدة',
      failureTitle: 'فشل الدفع',
      cancelledTitle: 'تم إلغاء الدفع',
      cancelledMessage: 'لم يتم خصم أي مبلغ.',
      pendingTitle: 'الدفع قيد الانتظار',
      pendingMessage: 'جارٍ التحقق من الدفع.',
      unknownTitle: 'حالة الدفع غير معروفة',
      unknownMessage:
        'تعذّر تأكيد الدفع. تحقق من الحالة قبل إعادة المحاولة — لا تُعد إرسال النموذج.',
      tryAgain: 'إعادة المحاولة',
      backToCheckout: 'العودة إلى إتمام الطلب',
      backToPayment: 'العودة إلى الدفع',
      waitingMessage: 'لا توجد نتيجة دفع بعد.',
      checkStatus: 'التحقق من الحالة',
      viewOrder: 'عرض الطلب',
    },
    errors: {
      unavailable: 'الدفع غير متاح حاليًا. حاول مرة أخرى.',
      setupFailed: 'فشل إعداد الدفع. حاول مرة أخرى.',
      declinedFallback: 'تم رفض الدفع.',
      verificationFailed: 'يبلّغ النظام الخلفي عن فشل الدفع.',
      notFound: 'الدفع غير موجود.',
    },
    summary: {
      title: 'ملخص الطلب',
      items: 'المنتجات',
      quantity: 'الكمية',
      unitPrice: 'سعر الوحدة',
      sku: 'SKU',
      orderNumber: 'رقم الطلب',
      subtotal: 'المجموع الفرعي',
      shippingCost: 'الشحن',
      discount: 'الخصم',
      grandTotal: 'الإجمالي',
    },
  },
};

/** Bundled payment dictionaries keyed by supported culture. */
export const PAYMENT_TRANSLATION_RESOURCES: TranslationResources = {
  en: EN_PAYMENT,
  fr: FR_PAYMENT,
  de: DE_PAYMENT,
  es: ES_PAYMENT,
  ar: AR_PAYMENT,
};

/**
 * Resolves a payment key to its localized string with deterministic
 * fallback: target culture → `en` → the key path itself. `params` fills
 * `{placeholder}` slots (e.g. `{orderId}`). Never throws.
 */
export function translatePaymentKey(
  culture: Culture,
  key: string,
  params: TranslationParams = {},
): string {
  return translate(PAYMENT_TRANSLATION_RESOURCES, culture, key, params);
}
