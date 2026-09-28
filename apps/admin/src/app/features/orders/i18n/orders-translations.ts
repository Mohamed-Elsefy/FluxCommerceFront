/**
 * Admin orders feature translations — user-facing copy (`orders.*`) in
 * all five supported cultures (`en`/`fr`/`de`/`es`/`ar`).
 *
 * Covers the Sub-Phase 14.2 landing page only (header plus the
 * backend-issued overview fact). List, filter, details, customer, and
 * payment copy arrives with the slices that own their pages
 * (Sub-Phases 14.3–14.8). Lookup runs through the Phase 4 `translate`
 * engine (deterministic target → `en` → key-path fallback). Pure data +
 * pure lookup: no Angular, DOM, or storage access — SSR-safe.
 */

import {
  translate,
  type Culture,
  type TranslationDictionary,
  type TranslationParams,
  type TranslationResources,
} from '@flux/i18n';

/** Admin orders translation key paths owned by this feature (`orders.*`). */
export const ORDERS_TRANSLATION_KEYS = {
  title: 'orders.title',
  subtitle: 'orders.subtitle',
  summaryHeading: 'orders.summary.heading',
  summaryTotal: 'orders.summary.total',
  loading: 'orders.loading',
  errorTitle: 'orders.errorTitle',
  emptyTitle: 'orders.emptyTitle',
  emptyMessage: 'orders.emptyMessage',
} as const;

/** English (`en`) orders vocabulary. Also the deterministic fallback source. */
const EN_ORDERS: TranslationDictionary = {
  orders: {
    title: 'Orders',
    subtitle: 'Review and inspect orders.',
    summary: {
      heading: 'Overview',
      total: '{count} orders',
    },
    loading: 'Loading orders…',
    errorTitle: 'Could not load orders',
    emptyTitle: 'No orders yet',
    emptyMessage: 'There are no orders to review.',
  },
};

/** French (`fr`) orders vocabulary. */
const FR_ORDERS: TranslationDictionary = {
  orders: {
    title: 'Commandes',
    subtitle: 'Consultez et inspectez les commandes.',
    summary: {
      heading: 'Aperçu',
      total: '{count} commandes',
    },
    loading: 'Chargement des commandes…',
    errorTitle: 'Impossible de charger les commandes',
    emptyTitle: 'Aucune commande',
    emptyMessage: 'Aucune commande à consulter.',
  },
};

/** German (`de`) orders vocabulary. */
const DE_ORDERS: TranslationDictionary = {
  orders: {
    title: 'Bestellungen',
    subtitle: 'Bestellungen einsehen und prüfen.',
    summary: {
      heading: 'Übersicht',
      total: '{count} Bestellungen',
    },
    loading: 'Bestellungen werden geladen…',
    errorTitle: 'Bestellungen konnten nicht geladen werden',
    emptyTitle: 'Keine Bestellungen',
    emptyMessage: 'Es gibt keine zu prüfenden Bestellungen.',
  },
};

/** Spanish (`es`) orders vocabulary. */
const ES_ORDERS: TranslationDictionary = {
  orders: {
    title: 'Pedidos',
    subtitle: 'Revise e inspeccione los pedidos.',
    summary: {
      heading: 'Resumen',
      total: '{count} pedidos',
    },
    loading: 'Cargando pedidos…',
    errorTitle: 'No se pudieron cargar los pedidos',
    emptyTitle: 'Sin pedidos',
    emptyMessage: 'No hay pedidos para revisar.',
  },
};

/** Arabic (`ar`) orders vocabulary. */
const AR_ORDERS: TranslationDictionary = {
  orders: {
    title: 'الطلبات',
    subtitle: 'راجع الطلبات وافحصها.',
    summary: {
      heading: 'نظرة عامة',
      total: '{count} طلبات',
    },
    loading: 'جارٍ تحميل الطلبات…',
    errorTitle: 'تعذّر تحميل الطلبات',
    emptyTitle: 'لا توجد طلبات',
    emptyMessage: 'لا توجد طلبات للمراجعة.',
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
 * fallback: target culture → `en` → the key path itself. Never throws.
 */
export function translateOrdersKey(
  culture: Culture,
  key: string,
  params: TranslationParams = {},
): string {
  return translate(ORDERS_TRANSLATION_RESOURCES, culture, key, params);
}
