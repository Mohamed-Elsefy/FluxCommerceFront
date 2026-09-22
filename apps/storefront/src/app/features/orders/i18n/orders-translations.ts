/**
 * Storefront Orders translations for Sub-Phases 10.3 (Orders List) and
 * 10.4 (Order Details).
 *
 * Feature-owned, business-specific copy (`orders.list` + `orders.details`
 * namespaces) in all five supported cultures (`en`/`fr`/`de`/`es`/`ar`).
 * Per the Phase 4 ownership rule, this bundle lives in the orders
 * feature next to the §10.2 account bundle and never touches `libs/i18n`
 * dictionaries. Generic vocabulary (retry) stays in the base resources
 * (`common.actions.retry`).
 *
 * Status values themselves are NOT translated here: the backend status
 * strings render verbatim until §10.5 builds the localized status
 * experience (constraint: no status derivation or mapping in §10.3–10.4).
 *
 * Lookup runs through the Phase 4 `translate` engine (deterministic
 * target → `en` → key-path fallback, `{param}` interpolation), resolved
 * against the active `CultureService.culture()` at the consuming page.
 * Pure data + pure lookup: no Angular, DOM, or storage access — SSR-safe.
 */

import {
  translate,
  type Culture,
  type TranslationDictionary,
  type TranslationParams,
  type TranslationResources,
} from '@flux/i18n';

/** Orders list translation key paths owned by this feature (`orders.list.*`). */
export const ORDERS_TRANSLATION_KEYS = {
  listTitle: 'orders.list.title',
  listLoading: 'orders.list.loading',
  listLoadErrorTitle: 'orders.list.loadErrorTitle',
  listEmptyTitle: 'orders.list.emptyTitle',
  listEmptyMessage: 'orders.list.emptyMessage',
  listFieldNumber: 'orders.list.fields.number',
  listFieldDate: 'orders.list.fields.date',
  listFieldStatus: 'orders.list.fields.status',
  listFieldItems: 'orders.list.fields.items',
  listFieldTotal: 'orders.list.fields.total',
  listPagerLabel: 'orders.list.pager.label',
  listPagerFirst: 'orders.list.pager.first',
  listPagerPrevious: 'orders.list.pager.previous',
  listPagerNext: 'orders.list.pager.next',
  listPagerLast: 'orders.list.pager.last',
  detailsTitle: 'orders.details.title',
  detailsLoading: 'orders.details.loading',
  detailsLoadErrorTitle: 'orders.details.loadErrorTitle',
  detailsNotFoundTitle: 'orders.details.notFoundTitle',
  detailsNotFoundMessage: 'orders.details.notFoundMessage',
  detailsForbiddenTitle: 'orders.details.forbiddenTitle',
  detailsForbiddenMessage: 'orders.details.forbiddenMessage',
  detailsUnauthorizedTitle: 'orders.details.unauthorizedTitle',
  detailsUnauthorizedMessage: 'orders.details.unauthorizedMessage',
  detailsBackToOrders: 'orders.details.backToOrders',
  detailsSignIn: 'orders.details.signIn',
  detailsSectionItems: 'orders.details.sections.items',
  detailsSectionShipping: 'orders.details.sections.shipping',
  detailsSectionBilling: 'orders.details.sections.billing',
  detailsSectionTotals: 'orders.details.sections.totals',
  detailsFieldOrderNumber: 'orders.details.fields.orderNumber',
  detailsFieldOrderId: 'orders.details.fields.orderId',
  detailsFieldDate: 'orders.details.fields.date',
  detailsFieldStatus: 'orders.details.fields.status',
  detailsFieldCustomer: 'orders.details.fields.customer',
  detailsFieldProduct: 'orders.details.fields.product',
  detailsFieldQuantity: 'orders.details.fields.quantity',
  detailsFieldUnitPrice: 'orders.details.fields.unitPrice',
  detailsFieldLineTotal: 'orders.details.fields.lineTotal',
  detailsFieldSku: 'orders.details.fields.sku',
  detailsFieldSubtotal: 'orders.details.fields.subtotal',
  detailsFieldDiscount: 'orders.details.fields.discount',
  detailsFieldShipping: 'orders.details.fields.shipping',
  detailsFieldGrandTotal: 'orders.details.fields.grandTotal',
  detailsItemsEmpty: 'orders.details.itemsEmpty',
  statusOrderPending: 'orders.status.order.pending',
  statusOrderCancelled: 'orders.status.order.cancelled',
  statusOrderConfirmed: 'orders.status.order.confirmed',
  statusOrderUnknown: 'orders.status.order.unknown',
  statusPaymentPending: 'orders.status.payment.pending',
  statusPaymentProcessing: 'orders.status.payment.processing',
  statusPaymentSucceeded: 'orders.status.payment.succeeded',
  statusPaymentFailed: 'orders.status.payment.failed',
  statusPaymentCancelled: 'orders.status.payment.cancelled',
  statusPaymentRefunded: 'orders.status.payment.refunded',
  statusPaymentUnknown: 'orders.status.payment.unknown',
} as const;

/** English (`en`) orders list vocabulary. Also the deterministic fallback source. */
const EN_ORDERS: TranslationDictionary = {
  orders: {
    list: {
      title: 'Orders',
      loading: 'Loading your orders…',
      loadErrorTitle: 'Orders unavailable',
      emptyTitle: 'No orders yet',
      emptyMessage: 'Orders you place will appear here.',
      fields: {
        number: 'Order',
        date: 'Date',
        status: 'Status',
        items: 'Items',
        total: 'Total',
      },
      pager: {
        label: 'Orders pages',
        first: 'First',
        previous: 'Previous',
        next: 'Next',
        last: 'Last',
      },
    },
    details: {
      title: 'Order {orderNumber}',
      loading: 'Loading order details…',
      loadErrorTitle: 'Order unavailable',
      notFoundTitle: 'Order not found',
      notFoundMessage: 'This order does not exist or belongs to another account.',
      forbiddenTitle: 'Access denied',
      forbiddenMessage: 'You do not have permission to view this order.',
      unauthorizedTitle: 'Sign-in required',
      unauthorizedMessage: 'Please sign in to view this order.',
      backToOrders: 'Back to orders',
      signIn: 'Sign in',
      sections: {
        items: 'Items',
        shipping: 'Shipping address',
        billing: 'Billing address',
        totals: 'Order totals',
      },
      fields: {
        orderNumber: 'Order number',
        orderId: 'Order ID',
        date: 'Order date',
        status: 'Order status',
        customer: 'Recipient',
        product: 'Product',
        quantity: 'Qty',
        unitPrice: 'Unit price',
        lineTotal: 'Line total',
        sku: 'SKU',
        subtotal: 'Subtotal',
        discount: 'Discount',
        shipping: 'Shipping',
        grandTotal: 'Grand total',
      },
      itemsEmpty: 'No items on this order.',
    },
    status: {
      order: {
        pending: 'Pending',
        cancelled: 'Cancelled',
        confirmed: 'Confirmed',
        unknown: 'Unknown order status',
      },
      payment: {
        pending: 'Pending',
        processing: 'Processing',
        succeeded: 'Succeeded',
        failed: 'Failed',
        cancelled: 'Cancelled',
        refunded: 'Refunded',
        unknown: 'Unknown payment status',
      },
    },
  },
};

/** French (`fr`) orders list vocabulary. */
const FR_ORDERS: TranslationDictionary = {
  orders: {
    list: {
      title: 'Commandes',
      loading: 'Chargement de vos commandes…',
      loadErrorTitle: 'Commandes indisponibles',
      emptyTitle: 'Aucune commande pour le moment',
      emptyMessage: 'Les commandes que vous passerez apparaîtront ici.',
      fields: {
        number: 'Commande',
        date: 'Date',
        status: 'Statut',
        items: 'Articles',
        total: 'Total',
      },
      pager: {
        label: 'Pages des commandes',
        first: 'Premier',
        previous: 'Précédent',
        next: 'Suivant',
        last: 'Dernier',
      },
    },
    details: {
      title: 'Commande {orderNumber}',
      loading: 'Chargement des détails de la commande…',
      loadErrorTitle: 'Commande indisponible',
      notFoundTitle: 'Commande introuvable',
      notFoundMessage: 'Cette commande n’existe pas ou appartient à un autre compte.',
      forbiddenTitle: 'Accès refusé',
      forbiddenMessage: 'Vous n’avez pas l’autorisation de voir cette commande.',
      unauthorizedTitle: 'Connexion requise',
      unauthorizedMessage: 'Veuillez vous connecter pour voir cette commande.',
      backToOrders: 'Retour aux commandes',
      signIn: 'Se connecter',
      sections: {
        items: 'Articles',
        shipping: 'Adresse de livraison',
        billing: 'Adresse de facturation',
        totals: 'Totaux de la commande',
      },
      fields: {
        orderNumber: 'Numéro de commande',
        orderId: 'Identifiant de commande',
        date: 'Date de commande',
        status: 'Statut de la commande',
        customer: 'Destinataire',
        product: 'Produit',
        quantity: 'Qté',
        unitPrice: 'Prix unitaire',
        lineTotal: 'Total de ligne',
        sku: 'SKU',
        subtotal: 'Sous-total',
        discount: 'Remise',
        shipping: 'Livraison',
        grandTotal: 'Total général',
      },
      itemsEmpty: 'Aucun article sur cette commande.',
    },
    status: {
      order: {
        pending: 'En attente',
        cancelled: 'Annulée',
        confirmed: 'Confirmée',
        unknown: 'Statut de commande inconnu',
      },
      payment: {
        pending: 'En attente',
        processing: 'En cours',
        succeeded: 'Réussi',
        failed: 'Échoué',
        cancelled: 'Annulé',
        refunded: 'Remboursé',
        unknown: 'Statut de paiement inconnu',
      },
    },
  },
};

/** German (`de`) orders list vocabulary. */
const DE_ORDERS: TranslationDictionary = {
  orders: {
    list: {
      title: 'Bestellungen',
      loading: 'Deine Bestellungen werden geladen…',
      loadErrorTitle: 'Bestellungen nicht verfügbar',
      emptyTitle: 'Noch keine Bestellungen',
      emptyMessage: 'Deine Bestellungen erscheinen hier.',
      fields: {
        number: 'Bestellung',
        date: 'Datum',
        status: 'Status',
        items: 'Artikel',
        total: 'Gesamt',
      },
      pager: {
        label: 'Bestellseiten',
        first: 'Erste',
        previous: 'Zurück',
        next: 'Weiter',
        last: 'Letzte',
      },
    },
    details: {
      title: 'Bestellung {orderNumber}',
      loading: 'Bestelldetails werden geladen…',
      loadErrorTitle: 'Bestellung nicht verfügbar',
      notFoundTitle: 'Bestellung nicht gefunden',
      notFoundMessage: 'Diese Bestellung existiert nicht oder gehört zu einem anderen Konto.',
      forbiddenTitle: 'Zugriff verweigert',
      forbiddenMessage: 'Du hast keine Berechtigung, diese Bestellung zu sehen.',
      unauthorizedTitle: 'Anmeldung erforderlich',
      unauthorizedMessage: 'Bitte melde dich an, um diese Bestellung zu sehen.',
      backToOrders: 'Zurück zu den Bestellungen',
      signIn: 'Anmelden',
      sections: {
        items: 'Artikel',
        shipping: 'Lieferadresse',
        billing: 'Rechnungsadresse',
        totals: 'Bestellsummen',
      },
      fields: {
        orderNumber: 'Bestellnummer',
        orderId: 'Bestell-ID',
        date: 'Bestelldatum',
        status: 'Bestellstatus',
        customer: 'Empfänger',
        product: 'Produkt',
        quantity: 'Menge',
        unitPrice: 'Stückpreis',
        lineTotal: 'Zeilensumme',
        sku: 'SKU',
        subtotal: 'Zwischensumme',
        discount: 'Rabatt',
        shipping: 'Versand',
        grandTotal: 'Gesamtsumme',
      },
      itemsEmpty: 'Keine Artikel auf dieser Bestellung.',
    },
    status: {
      order: {
        pending: 'Ausstehend',
        cancelled: 'Storniert',
        confirmed: 'Bestätigt',
        unknown: 'Unbekannter Bestellstatus',
      },
      payment: {
        pending: 'Ausstehend',
        processing: 'In Bearbeitung',
        succeeded: 'Erfolgreich',
        failed: 'Fehlgeschlagen',
        cancelled: 'Storniert',
        refunded: 'Erstattet',
        unknown: 'Unbekannter Zahlungsstatus',
      },
    },
  },
};

/** Spanish (`es`) orders list vocabulary. */
const ES_ORDERS: TranslationDictionary = {
  orders: {
    list: {
      title: 'Pedidos',
      loading: 'Cargando tus pedidos…',
      loadErrorTitle: 'Pedidos no disponibles',
      emptyTitle: 'Aún no tienes pedidos',
      emptyMessage: 'Los pedidos que realices aparecerán aquí.',
      fields: {
        number: 'Pedido',
        date: 'Fecha',
        status: 'Estado',
        items: 'Artículos',
        total: 'Total',
      },
      pager: {
        label: 'Páginas de pedidos',
        first: 'Primera',
        previous: 'Anterior',
        next: 'Siguiente',
        last: 'Última',
      },
    },
    details: {
      title: 'Pedido {orderNumber}',
      loading: 'Cargando los detalles del pedido…',
      loadErrorTitle: 'Pedido no disponible',
      notFoundTitle: 'Pedido no encontrado',
      notFoundMessage: 'Este pedido no existe o pertenece a otra cuenta.',
      forbiddenTitle: 'Acceso denegado',
      forbiddenMessage: 'No tienes permiso para ver este pedido.',
      unauthorizedTitle: 'Inicio de sesión requerido',
      unauthorizedMessage: 'Inicia sesión para ver este pedido.',
      backToOrders: 'Volver a los pedidos',
      signIn: 'Iniciar sesión',
      sections: {
        items: 'Artículos',
        shipping: 'Dirección de envío',
        billing: 'Dirección de facturación',
        totals: 'Totales del pedido',
      },
      fields: {
        orderNumber: 'Número de pedido',
        orderId: 'ID del pedido',
        date: 'Fecha del pedido',
        status: 'Estado del pedido',
        customer: 'Destinatario',
        product: 'Producto',
        quantity: 'Cant.',
        unitPrice: 'Precio unitario',
        lineTotal: 'Total de línea',
        sku: 'SKU',
        subtotal: 'Subtotal',
        discount: 'Descuento',
        shipping: 'Envío',
        grandTotal: 'Total general',
      },
      itemsEmpty: 'Este pedido no tiene artículos.',
    },
    status: {
      order: {
        pending: 'Pendiente',
        cancelled: 'Cancelado',
        confirmed: 'Confirmado',
        unknown: 'Estado del pedido desconocido',
      },
      payment: {
        pending: 'Pendiente',
        processing: 'En proceso',
        succeeded: 'Exitoso',
        failed: 'Fallido',
        cancelled: 'Cancelado',
        refunded: 'Reembolsado',
        unknown: 'Estado del pago desconocido',
      },
    },
  },
};

/** Arabic (`ar`) orders list vocabulary. */
const AR_ORDERS: TranslationDictionary = {
  orders: {
    list: {
      title: 'الطلبات',
      loading: 'جارٍ تحميل طلباتك…',
      loadErrorTitle: 'الطلبات غير متاحة',
      emptyTitle: 'لا توجد طلبات بعد',
      emptyMessage: 'ستظهر الطلبات التي تقدمها هنا.',
      fields: {
        number: 'الطلب',
        date: 'التاريخ',
        status: 'الحالة',
        items: 'المنتجات',
        total: 'الإجمالي',
      },
      pager: {
        label: 'صفحات الطلبات',
        first: 'الأولى',
        previous: 'السابق',
        next: 'التالي',
        last: 'الأخيرة',
      },
    },
    details: {
      title: 'الطلب {orderNumber}',
      loading: 'جارٍ تحميل تفاصيل الطلب…',
      loadErrorTitle: 'الطلب غير متاح',
      notFoundTitle: 'الطلب غير موجود',
      notFoundMessage: 'هذا الطلب غير موجود أو يخص حسابًا آخر.',
      forbiddenTitle: 'تم رفض الوصول',
      forbiddenMessage: 'ليس لديك إذن لعرض هذا الطلب.',
      unauthorizedTitle: 'تسجيل الدخول مطلوب',
      unauthorizedMessage: 'يرجى تسجيل الدخول لعرض هذا الطلب.',
      backToOrders: 'العودة إلى الطلبات',
      signIn: 'تسجيل الدخول',
      sections: {
        items: 'المنتجات',
        shipping: 'عنوان الشحن',
        billing: 'عنوان الفوترة',
        totals: 'إجماليات الطلب',
      },
      fields: {
        orderNumber: 'رقم الطلب',
        orderId: 'معرّف الطلب',
        date: 'تاريخ الطلب',
        status: 'حالة الطلب',
        customer: 'المستلم',
        product: 'المنتج',
        quantity: 'الكمية',
        unitPrice: 'سعر الوحدة',
        lineTotal: 'إجمالي السطر',
        sku: 'SKU',
        subtotal: 'المجموع الفرعي',
        discount: 'الخصم',
        shipping: 'الشحن',
        grandTotal: 'الإجمالي العام',
      },
      itemsEmpty: 'لا توجد منتجات على هذا الطلب.',
    },
    status: {
      order: {
        pending: 'قيد الانتظار',
        cancelled: 'ملغي',
        confirmed: 'مؤكد',
        unknown: 'حالة طلب غير معروفة',
      },
      payment: {
        pending: 'قيد الانتظار',
        processing: 'قيد المعالجة',
        succeeded: 'ناجح',
        failed: 'فشل',
        cancelled: 'ملغي',
        refunded: 'مسترد',
        unknown: 'حالة دفع غير معروفة',
      },
    },
  },
};

/** Bundled orders dictionaries keyed by supported culture. */
export const ORDERS_TRANSLATION_RESOURCES: TranslationResources = {
  en: EN_ORDERS,
  fr: FR_ORDERS,
  de: DE_ORDERS,
  es: ES_ORDERS,
  ar: AR_ORDERS,
};

/**
 * Resolves an orders key to its localized string with deterministic
 * fallback: target culture → `en` → the key path itself. `params` fills
 * `{placeholder}` slots (e.g. `{orderNumber}`). Never throws.
 */
export function translateOrdersKey(
  culture: Culture,
  key: string,
  params: TranslationParams = {},
): string {
  return translate(ORDERS_TRANSLATION_RESOURCES, culture, key, params);
}
