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
  listHeading: 'orders.list.heading',
  listSubheading: 'orders.list.subheading',
  listCaption: 'orders.list.caption',
  listColNumber: 'orders.list.colNumber',
  listColStatus: 'orders.list.colStatus',
  listColTotal: 'orders.list.colTotal',
  listColItems: 'orders.list.colItems',
  listColCreated: 'orders.list.colCreated',
  listLoading: 'orders.list.loading',
  listEmptyTitle: 'orders.list.emptyTitle',
  listEmptyMessage: 'orders.list.emptyMessage',
  listErrorTitle: 'orders.list.errorTitle',
  paginationLabel: 'orders.pagination.label',
  paginationFirst: 'orders.pagination.first',
  paginationPrevious: 'orders.pagination.previous',
  paginationNext: 'orders.pagination.next',
  paginationLast: 'orders.pagination.last',
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
    list: {
      heading: 'Orders',
      subheading: 'Browse orders, newest first.',
      caption: 'Orders',
      colNumber: 'Order',
      colStatus: 'Status',
      colTotal: 'Total',
      colItems: 'Items',
      colCreated: 'Created',
      loading: 'Loading orders…',
      emptyTitle: 'No orders found',
      emptyMessage: 'There are no orders on this page.',
      errorTitle: 'Could not load orders',
    },
    pagination: {
      label: 'Order pages',
      first: 'First',
      previous: 'Previous',
      next: 'Next',
      last: 'Last',
    },
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
    list: {
      heading: 'Commandes',
      subheading: 'Parcourez les commandes, les plus récentes d’abord.',
      caption: 'Commandes',
      colNumber: 'Commande',
      colStatus: 'Statut',
      colTotal: 'Total',
      colItems: 'Articles',
      colCreated: 'Créée',
      loading: 'Chargement des commandes…',
      emptyTitle: 'Aucune commande trouvée',
      emptyMessage: 'Il n’y a aucune commande sur cette page.',
      errorTitle: 'Impossible de charger les commandes',
    },
    pagination: {
      label: 'Pages de commandes',
      first: 'Première',
      previous: 'Précédente',
      next: 'Suivante',
      last: 'Dernière',
    },
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
    list: {
      heading: 'Bestellungen',
      subheading: 'Bestellungen durchsuchen, neueste zuerst.',
      caption: 'Bestellungen',
      colNumber: 'Bestellung',
      colStatus: 'Status',
      colTotal: 'Gesamtbetrag',
      colItems: 'Positionen',
      colCreated: 'Erstellt',
      loading: 'Bestellungen werden geladen…',
      emptyTitle: 'Keine Bestellungen gefunden',
      emptyMessage: 'Auf dieser Seite gibt es keine Bestellungen.',
      errorTitle: 'Bestellungen konnten nicht geladen werden',
    },
    pagination: {
      label: 'Bestellseiten',
      first: 'Erste',
      previous: 'Zurück',
      next: 'Weiter',
      last: 'Letzte',
    },
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
    list: {
      heading: 'Pedidos',
      subheading: 'Explore los pedidos, los más recientes primero.',
      caption: 'Pedidos',
      colNumber: 'Pedido',
      colStatus: 'Estado',
      colTotal: 'Total',
      colItems: 'Artículos',
      colCreated: 'Creado',
      loading: 'Cargando pedidos…',
      emptyTitle: 'No se encontraron pedidos',
      emptyMessage: 'No hay pedidos en esta página.',
      errorTitle: 'No se pudieron cargar los pedidos',
    },
    pagination: {
      label: 'Páginas de pedidos',
      first: 'Primera',
      previous: 'Anterior',
      next: 'Siguiente',
      last: 'Última',
    },
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
    list: {
      heading: 'الطلبات',
      subheading: 'تصفح الطلبات، الأحدث أولاً.',
      caption: 'الطلبات',
      colNumber: 'الطلب',
      colStatus: 'الحالة',
      colTotal: 'الإجمالي',
      colItems: 'الأصناف',
      colCreated: 'أُنشئ',
      loading: 'جارٍ تحميل الطلبات…',
      emptyTitle: 'لم يتم العثور على طلبات',
      emptyMessage: 'لا توجد طلبات في هذه الصفحة.',
      errorTitle: 'تعذّر تحميل الطلبات',
    },
    pagination: {
      label: 'صفحات الطلبات',
      first: 'الأولى',
      previous: 'السابقة',
      next: 'التالية',
      last: 'الأخيرة',
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
 * fallback: target culture → `en` → the key path itself. Never throws.
 */
export function translateOrdersKey(
  culture: Culture,
  key: string,
  params: TranslationParams = {},
): string {
  return translate(ORDERS_TRANSLATION_RESOURCES, culture, key, params);
}
