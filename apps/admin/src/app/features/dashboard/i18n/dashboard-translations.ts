/**
 * Admin dashboard feature translations — user-facing copy (`dashboard.*`)
 * in all five supported cultures (`en`/`fr`/`de`/`es`/`ar`).
 *
 * Covers the page header, the live session card, and the Supplement
 * S1.10 live snapshot: per-module overview cards (orders, payments,
 * inventory, users — backend-issued counts, display only) plus the
 * recent-orders drill-down widget. Lookup runs through the Phase 4
 * `translate` engine (deterministic target → `en` → key-path fallback).
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

/** Dashboard translation key paths owned by this feature (`dashboard.*`). */
export const DASHBOARD_TRANSLATION_KEYS = {
  title: 'dashboard.title',
  subtitle: 'dashboard.subtitle',
  sessionHeading: 'dashboard.session.heading',
  sessionName: 'dashboard.session.name',
  sessionEmail: 'dashboard.session.email',
  sessionRoles: 'dashboard.session.roles',
  snapshotLoading: 'dashboard.snapshot.loading',
  snapshotErrorTitle: 'dashboard.snapshot.errorTitle',
  ordersTitle: 'dashboard.sections.ordersTitle',
  ordersLink: 'dashboard.sections.ordersLink',
  ordersTotal: 'dashboard.sections.ordersTotal',
  ordersPending: 'dashboard.sections.ordersPending',
  ordersConfirmed: 'dashboard.sections.ordersConfirmed',
  ordersCancelled: 'dashboard.sections.ordersCancelled',
  paymentsTitle: 'dashboard.sections.paymentsTitle',
  paymentsLink: 'dashboard.sections.paymentsLink',
  paymentsTotal: 'dashboard.sections.paymentsTotal',
  paymentsSucceeded: 'dashboard.sections.paymentsSucceeded',
  paymentsFailed: 'dashboard.sections.paymentsFailed',
  paymentsRefunded: 'dashboard.sections.paymentsRefunded',
  inventoryTitle: 'dashboard.sections.inventoryTitle',
  inventoryLink: 'dashboard.sections.inventoryLink',
  inventoryTotal: 'dashboard.sections.inventoryTotal',
  inventoryOnHand: 'dashboard.sections.inventoryOnHand',
  inventoryReserved: 'dashboard.sections.inventoryReserved',
  inventoryLowStock: 'dashboard.sections.inventoryLowStock',
  usersTitle: 'dashboard.sections.usersTitle',
  usersLink: 'dashboard.sections.usersLink',
  usersTotal: 'dashboard.sections.usersTotal',
  usersAdmins: 'dashboard.sections.usersAdmins',
  usersSuperAdmins: 'dashboard.sections.usersSuperAdmins',
  usersCustomers: 'dashboard.sections.usersCustomers',
  recentTitle: 'dashboard.recent.title',
  recentEmpty: 'dashboard.recent.empty',
  recentLink: 'dashboard.recent.link',
} as const;

/** English (`en`) dashboard vocabulary. Also the deterministic fallback source. */
const EN_DASHBOARD: TranslationDictionary = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Live portal overview.',
    session: {
      heading: 'Your session',
      name: 'Name',
      email: 'Email',
      roles: 'Roles',
    },
    snapshot: {
      loading: 'Loading overview…',
      errorTitle: 'Could not load overview',
    },
    sections: {
      ordersTitle: 'Orders',
      ordersLink: 'View orders list',
      ordersTotal: '{count} orders',
      ordersPending: 'Pending',
      ordersConfirmed: 'Confirmed',
      ordersCancelled: 'Cancelled',
      paymentsTitle: 'Payments',
      paymentsLink: 'View payments list',
      paymentsTotal: '{count} payments',
      paymentsSucceeded: 'Succeeded',
      paymentsFailed: 'Failed',
      paymentsRefunded: 'Refunded',
      inventoryTitle: 'Inventory',
      inventoryLink: 'View stock list',
      inventoryTotal: '{count} items',
      inventoryOnHand: 'On hand',
      inventoryReserved: 'Reserved',
      inventoryLowStock: 'Low stock',
      usersTitle: 'Users',
      usersLink: 'View users list',
      usersTotal: '{count} users',
      usersAdmins: 'Admins',
      usersSuperAdmins: 'Super admins',
      usersCustomers: 'Customers',
    },
    recent: {
      title: 'Recent orders',
      empty: 'No recent orders.',
      link: 'View order',
    },
  },
};

/** French (`fr`) dashboard vocabulary. */
const FR_DASHBOARD: TranslationDictionary = {
  dashboard: {
    title: 'Tableau de bord',
    subtitle: 'Aperçu du portail en direct.',
    session: {
      heading: 'Votre session',
      name: 'Nom',
      email: 'E-mail',
      roles: 'Rôles',
    },
    snapshot: {
      loading: 'Chargement de l’aperçu…',
      errorTitle: 'Impossible de charger l’aperçu',
    },
    sections: {
      ordersTitle: 'Commandes',
      ordersLink: 'Voir la liste des commandes',
      ordersTotal: '{count} commandes',
      ordersPending: 'En attente',
      ordersConfirmed: 'Confirmées',
      ordersCancelled: 'Annulées',
      paymentsTitle: 'Paiements',
      paymentsLink: 'Voir la liste des paiements',
      paymentsTotal: '{count} paiements',
      paymentsSucceeded: 'Réussis',
      paymentsFailed: 'Échoués',
      paymentsRefunded: 'Remboursés',
      inventoryTitle: 'Inventaire',
      inventoryLink: 'Voir la liste du stock',
      inventoryTotal: '{count} articles',
      inventoryOnHand: 'En stock',
      inventoryReserved: 'Réservé',
      inventoryLowStock: 'Stock bas',
      usersTitle: 'Utilisateurs',
      usersLink: 'Voir la liste des utilisateurs',
      usersTotal: '{count} utilisateurs',
      usersAdmins: 'Admins',
      usersSuperAdmins: 'Super admins',
      usersCustomers: 'Clients',
    },
    recent: {
      title: 'Commandes récentes',
      empty: 'Aucune commande récente.',
      link: 'Voir la commande',
    },
  },
};

/** German (`de`) dashboard vocabulary. */
const DE_DASHBOARD: TranslationDictionary = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Live-Portalübersicht.',
    session: {
      heading: 'Ihre Sitzung',
      name: 'Name',
      email: 'E-Mail',
      roles: 'Rollen',
    },
    snapshot: {
      loading: 'Übersicht wird geladen…',
      errorTitle: 'Übersicht konnte nicht geladen werden',
    },
    sections: {
      ordersTitle: 'Bestellungen',
      ordersLink: 'Bestellliste ansehen',
      ordersTotal: '{count} Bestellungen',
      ordersPending: 'Ausstehend',
      ordersConfirmed: 'Bestätigt',
      ordersCancelled: 'Abgebrochen',
      paymentsTitle: 'Zahlungen',
      paymentsLink: 'Zahlungsliste ansehen',
      paymentsTotal: '{count} Zahlungen',
      paymentsSucceeded: 'Erfolgreich',
      paymentsFailed: 'Fehlgeschlagen',
      paymentsRefunded: 'Erstattet',
      inventoryTitle: 'Bestand',
      inventoryLink: 'Bestandsliste ansehen',
      inventoryTotal: '{count} Artikel',
      inventoryOnHand: 'Verfügbar',
      inventoryReserved: 'Reserviert',
      inventoryLowStock: 'Niedriger Bestand',
      usersTitle: 'Benutzer',
      usersLink: 'Benutzerliste ansehen',
      usersTotal: '{count} Benutzer',
      usersAdmins: 'Admins',
      usersSuperAdmins: 'Super-Admins',
      usersCustomers: 'Kunden',
    },
    recent: {
      title: 'Neueste Bestellungen',
      empty: 'Keine neuesten Bestellungen.',
      link: 'Bestellung ansehen',
    },
  },
};

/** Spanish (`es`) dashboard vocabulary. */
const ES_DASHBOARD: TranslationDictionary = {
  dashboard: {
    title: 'Panel',
    subtitle: 'Resumen del portal en directo.',
    session: {
      heading: 'Tu sesión',
      name: 'Nombre',
      email: 'Correo',
      roles: 'Roles',
    },
    snapshot: {
      loading: 'Cargando resumen…',
      errorTitle: 'No se pudo cargar el resumen',
    },
    sections: {
      ordersTitle: 'Pedidos',
      ordersLink: 'Ver la lista de pedidos',
      ordersTotal: '{count} pedidos',
      ordersPending: 'Pendientes',
      ordersConfirmed: 'Confirmados',
      ordersCancelled: 'Cancelados',
      paymentsTitle: 'Pagos',
      paymentsLink: 'Ver la lista de pagos',
      paymentsTotal: '{count} pagos',
      paymentsSucceeded: 'Correctos',
      paymentsFailed: 'Fallidos',
      paymentsRefunded: 'Reembolsados',
      inventoryTitle: 'Inventario',
      inventoryLink: 'Ver la lista de stock',
      inventoryTotal: '{count} artículos',
      inventoryOnHand: 'Disponible',
      inventoryReserved: 'Reservado',
      inventoryLowStock: 'Stock bajo',
      usersTitle: 'Usuarios',
      usersLink: 'Ver la lista de usuarios',
      usersTotal: '{count} usuarios',
      usersAdmins: 'Admins',
      usersSuperAdmins: 'Superadmins',
      usersCustomers: 'Clientes',
    },
    recent: {
      title: 'Pedidos recientes',
      empty: 'Sin pedidos recientes.',
      link: 'Ver el pedido',
    },
  },
};

/** Arabic (`ar`) dashboard vocabulary. */
const AR_DASHBOARD: TranslationDictionary = {
  dashboard: {
    title: 'لوحة التحكم',
    subtitle: 'نظرة عامة حية على البوابة.',
    session: {
      heading: 'جلستك',
      name: 'الاسم',
      email: 'البريد',
      roles: 'الأدوار',
    },
    snapshot: {
      loading: 'جارٍ تحميل النظرة العامة…',
      errorTitle: 'تعذّر تحميل النظرة العامة',
    },
    sections: {
      ordersTitle: 'الطلبات',
      ordersLink: 'عرض قائمة الطلبات',
      ordersTotal: '{count} طلبات',
      ordersPending: 'معلّقة',
      ordersConfirmed: 'مؤكّدة',
      ordersCancelled: 'ملغاة',
      paymentsTitle: 'المدفوعات',
      paymentsLink: 'عرض قائمة المدفوعات',
      paymentsTotal: '{count} مدفوعات',
      paymentsSucceeded: 'ناجحة',
      paymentsFailed: 'فاشلة',
      paymentsRefunded: 'مستردة',
      inventoryTitle: 'المخزون',
      inventoryLink: 'عرض قائمة المخزون',
      inventoryTotal: '{count} أصناف',
      inventoryOnHand: 'المتاح',
      inventoryReserved: 'المحجوز',
      inventoryLowStock: 'مخزون منخفض',
      usersTitle: 'المستخدمون',
      usersLink: 'عرض قائمة المستخدمين',
      usersTotal: '{count} مستخدمون',
      usersAdmins: 'المشرفون',
      usersSuperAdmins: 'المشرفون العامون',
      usersCustomers: 'العملاء',
    },
    recent: {
      title: 'أحدث الطلبات',
      empty: 'لا توجد طلبات حديثة.',
      link: 'عرض الطلب',
    },
  },
};

/** Bundled dashboard dictionaries keyed by supported culture. */
export const DASHBOARD_TRANSLATION_RESOURCES: TranslationResources = {
  en: EN_DASHBOARD,
  fr: FR_DASHBOARD,
  de: DE_DASHBOARD,
  es: ES_DASHBOARD,
  ar: AR_DASHBOARD,
};

/**
 * Resolves a dashboard key to its localized string with deterministic
 * fallback: target culture → `en` → the key path itself. Never throws.
 */
export function translateDashboardKey(
  culture: Culture,
  key: string,
  params: TranslationParams = {},
): string {
  return translate(DASHBOARD_TRANSLATION_RESOURCES, culture, key, params);
}
