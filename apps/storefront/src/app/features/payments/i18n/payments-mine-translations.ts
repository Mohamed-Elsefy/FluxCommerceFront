/**
 * Storefront Payments-Mine feature translations for Supplement S1,
 * Step S1.9 — Payments: Mine + Admin + Stats (storefront slice).
 *
 * Feature-owned, mine-specific copy (`paymentMine` namespace) in all
 * five supported cultures (`en`/`fr`/`de`/`es`/`ar`). Per the Phase 4
 * ownership rule, this bundle lives in the payments feature and never
 * touches `libs/i18n` dictionaries or the `payment.*` bundle (owned by
 * the payment flow).
 *
 * Lookup runs through the Phase 4 `translate` engine (deterministic
 * target → `en` → key-path fallback, `{param}` interpolation), resolved
 * against the active `CultureService.culture()` at the consuming page.
 * Generic vocabulary (retry actions) stays in the base resources and is
 * referenced via `translateKey`, never duplicated here.
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

/** Payments-mine translation key paths owned by this feature (`paymentMine.*`). */
export const PAYMENTS_MINE_TRANSLATION_KEYS = {
  title: 'paymentMine.title',
  filterLabel: 'paymentMine.filter.label',
  filterAll: 'paymentMine.filter.all',
  loading: 'paymentMine.loading',
  loadErrorTitle: 'paymentMine.loadErrorTitle',
  emptyTitle: 'paymentMine.emptyTitle',
  emptyMessage: 'paymentMine.emptyMessage',
  fieldOrder: 'paymentMine.fields.order',
  fieldAmount: 'paymentMine.fields.amount',
  fieldStatus: 'paymentMine.fields.status',
  fieldDate: 'paymentMine.fields.date',
  pagerLabel: 'paymentMine.pager.label',
  pagerFirst: 'paymentMine.pager.first',
  pagerPrevious: 'paymentMine.pager.previous',
  pagerNext: 'paymentMine.pager.next',
  pagerLast: 'paymentMine.pager.last',
  statusPending: 'paymentMine.status.pending',
  statusProcessing: 'paymentMine.status.processing',
  statusSucceeded: 'paymentMine.status.succeeded',
  statusFailed: 'paymentMine.status.failed',
  statusCancelled: 'paymentMine.status.cancelled',
  statusRefunded: 'paymentMine.status.refunded',
} as const;

/** English (`en`) payments-mine vocabulary. Also the deterministic fallback source. */
const EN_PAYMENTS_MINE: TranslationDictionary = {
  paymentMine: {
    title: 'My payments',
    filter: {
      label: 'Status',
      all: 'All',
    },
    loading: 'Loading payments…',
    loadErrorTitle: 'Could not load payments',
    emptyTitle: 'No payments yet',
    emptyMessage: 'Your payments will appear here after checkout.',
    fields: {
      order: 'Order',
      amount: 'Amount',
      status: 'Status',
      date: 'Date',
    },
    pager: {
      label: 'Payment pages',
      first: 'First',
      previous: 'Previous',
      next: 'Next',
      last: 'Last',
    },
    status: {
      pending: 'Pending',
      processing: 'Processing',
      succeeded: 'Succeeded',
      failed: 'Failed',
      cancelled: 'Cancelled',
      refunded: 'Refunded',
    },
  },
};

/** French (`fr`) payments-mine vocabulary. */
const FR_PAYMENTS_MINE: TranslationDictionary = {
  paymentMine: {
    title: 'Mes paiements',
    filter: {
      label: 'Statut',
      all: 'Tous',
    },
    loading: 'Chargement des paiements…',
    loadErrorTitle: 'Impossible de charger les paiements',
    emptyTitle: 'Aucun paiement pour le moment',
    emptyMessage: 'Vos paiements apparaîtront ici après votre commande.',
    fields: {
      order: 'Commande',
      amount: 'Montant',
      status: 'Statut',
      date: 'Date',
    },
    pager: {
      label: 'Pages de paiements',
      first: 'Première',
      previous: 'Précédente',
      next: 'Suivante',
      last: 'Dernière',
    },
    status: {
      pending: 'En attente',
      processing: 'En cours',
      succeeded: 'Réussi',
      failed: 'Échoué',
      cancelled: 'Annulé',
      refunded: 'Remboursé',
    },
  },
};

/** German (`de`) payments-mine vocabulary. */
const DE_PAYMENTS_MINE: TranslationDictionary = {
  paymentMine: {
    title: 'Meine Zahlungen',
    filter: {
      label: 'Status',
      all: 'Alle',
    },
    loading: 'Zahlungen werden geladen…',
    loadErrorTitle: 'Zahlungen konnten nicht geladen werden',
    emptyTitle: 'Noch keine Zahlungen',
    emptyMessage: 'Ihre Zahlungen erscheinen hier nach der Bestellung.',
    fields: {
      order: 'Bestellung',
      amount: 'Betrag',
      status: 'Status',
      date: 'Datum',
    },
    pager: {
      label: 'Zahlungsseiten',
      first: 'Erste',
      previous: 'Vorherige',
      next: 'Nächste',
      last: 'Letzte',
    },
    status: {
      pending: 'Ausstehend',
      processing: 'In Verarbeitung',
      succeeded: 'Erfolgreich',
      failed: 'Fehlgeschlagen',
      cancelled: 'Abgebrochen',
      refunded: 'Erstattet',
    },
  },
};

/** Spanish (`es`) payments-mine vocabulary. */
const ES_PAYMENTS_MINE: TranslationDictionary = {
  paymentMine: {
    title: 'Mis pagos',
    filter: {
      label: 'Estado',
      all: 'Todos',
    },
    loading: 'Cargando pagos…',
    loadErrorTitle: 'No se pudieron cargar los pagos',
    emptyTitle: 'Aún no hay pagos',
    emptyMessage: 'Tus pagos aparecerán aquí después de tu pedido.',
    fields: {
      order: 'Pedido',
      amount: 'Importe',
      status: 'Estado',
      date: 'Fecha',
    },
    pager: {
      label: 'Páginas de pagos',
      first: 'Primera',
      previous: 'Anterior',
      next: 'Siguiente',
      last: 'Última',
    },
    status: {
      pending: 'Pendiente',
      processing: 'En proceso',
      succeeded: 'Correcto',
      failed: 'Fallido',
      cancelled: 'Cancelado',
      refunded: 'Reembolsado',
    },
  },
};

/** Arabic (`ar`, RTL) payments-mine vocabulary. */
const AR_PAYMENTS_MINE: TranslationDictionary = {
  paymentMine: {
    title: 'مدفوعاتي',
    filter: {
      label: 'الحالة',
      all: 'الكل',
    },
    loading: 'جارٍ تحميل المدفوعات…',
    loadErrorTitle: 'تعذّر تحميل المدفوعات',
    emptyTitle: 'لا توجد مدفوعات بعد',
    emptyMessage: 'ستظهر مدفوعاتك هنا بعد إتمام الطلب.',
    fields: {
      order: 'الطلب',
      amount: 'المبلغ',
      status: 'الحالة',
      date: 'التاريخ',
    },
    pager: {
      label: 'صفحات المدفوعات',
      first: 'الأولى',
      previous: 'السابقة',
      next: 'التالية',
      last: 'الأخيرة',
    },
    status: {
      pending: 'معلّق',
      processing: 'قيد المعالجة',
      succeeded: 'ناجح',
      failed: 'فشل',
      cancelled: 'ملغى',
      refunded: 'مسترد',
    },
  },
};

/** Bundled payments-mine dictionaries keyed by supported culture. */
export const PAYMENTS_MINE_TRANSLATION_RESOURCES: TranslationResources = {
  en: EN_PAYMENTS_MINE,
  fr: FR_PAYMENTS_MINE,
  de: DE_PAYMENTS_MINE,
  es: ES_PAYMENTS_MINE,
  ar: AR_PAYMENTS_MINE,
};

/**
 * Resolves a payments-mine key to its localized string with deterministic
 * fallback: target culture → `en` → the key path itself. Never throws.
 */
export function translatePaymentsMineKey(
  culture: Culture,
  key: string,
  params?: TranslationParams,
): string {
  return translate(PAYMENTS_MINE_TRANSLATION_RESOURCES, culture, key, params);
}
