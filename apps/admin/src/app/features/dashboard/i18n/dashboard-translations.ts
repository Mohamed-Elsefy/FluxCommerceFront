/**
 * Admin dashboard feature translations — user-facing copy (`dashboard.*`)
 * in all five supported cultures (`en`/`fr`/`de`/`es`/`ar`).
 *
 * Covers the page header, the live session card, and the upcoming-module
 * cards. Module copy names the areas honestly (no metrics, no invented
 * data — real module content arrives with Phases 13–14). Lookup runs
 * through the Phase 4 `translate` engine (deterministic target → `en` →
 * key-path fallback). Pure data + pure lookup: no Angular, DOM, or
 * storage access — SSR-safe.
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
  modulesHeading: 'dashboard.modules.heading',
  catalogTitle: 'dashboard.modules.catalogTitle',
  catalogDescription: 'dashboard.modules.catalogDescription',
  inventoryTitle: 'dashboard.modules.inventoryTitle',
  inventoryDescription: 'dashboard.modules.inventoryDescription',
  ordersTitle: 'dashboard.modules.ordersTitle',
  ordersDescription: 'dashboard.modules.ordersDescription',
  paymentsTitle: 'dashboard.modules.paymentsTitle',
  paymentsDescription: 'dashboard.modules.paymentsDescription',
  upcomingBadge: 'dashboard.modules.upcoming',
} as const;

/** English (`en`) dashboard vocabulary. Also the deterministic fallback source. */
const EN_DASHBOARD: TranslationDictionary = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Portal overview and module status.',
    session: {
      heading: 'Your session',
      name: 'Name',
      email: 'Email',
      roles: 'Roles',
    },
    modules: {
      heading: 'Modules',
      catalogTitle: 'Catalog',
      catalogDescription: 'Products, variants, categories, images, and specifications.',
      inventoryTitle: 'Inventory',
      inventoryDescription: 'Stock levels, reservations, and adjustments.',
      ordersTitle: 'Orders',
      ordersDescription: 'Customer orders and order status.',
      paymentsTitle: 'Payments',
      paymentsDescription: 'Payment status and history.',
      upcoming: 'Upcoming',
    },
  },
};

/** French (`fr`) dashboard vocabulary. */
const FR_DASHBOARD: TranslationDictionary = {
  dashboard: {
    title: 'Tableau de bord',
    subtitle: 'Aperçu du portail et état des modules.',
    session: {
      heading: 'Votre session',
      name: 'Nom',
      email: 'E-mail',
      roles: 'Rôles',
    },
    modules: {
      heading: 'Modules',
      catalogTitle: 'Catalogue',
      catalogDescription: 'Produits, variantes, catégories, images et spécifications.',
      inventoryTitle: 'Inventaire',
      inventoryDescription: 'Niveaux de stock, réservations et ajustements.',
      ordersTitle: 'Commandes',
      ordersDescription: 'Commandes clients et état des commandes.',
      paymentsTitle: 'Paiements',
      paymentsDescription: 'État et historique des paiements.',
      upcoming: 'Bientôt',
    },
  },
};

/** German (`de`) dashboard vocabulary. */
const DE_DASHBOARD: TranslationDictionary = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Portalübersicht und Modulstatus.',
    session: {
      heading: 'Ihre Sitzung',
      name: 'Name',
      email: 'E-Mail',
      roles: 'Rollen',
    },
    modules: {
      heading: 'Module',
      catalogTitle: 'Katalog',
      catalogDescription: 'Produkte, Varianten, Kategorien, Bilder und Spezifikationen.',
      inventoryTitle: 'Bestand',
      inventoryDescription: 'Bestände, Reservierungen und Anpassungen.',
      ordersTitle: 'Bestellungen',
      ordersDescription: 'Kundenbestellungen und Bestellstatus.',
      paymentsTitle: 'Zahlungen',
      paymentsDescription: 'Zahlungsstatus und -verlauf.',
      upcoming: 'Demnächst',
    },
  },
};

/** Spanish (`es`) dashboard vocabulary. */
const ES_DASHBOARD: TranslationDictionary = {
  dashboard: {
    title: 'Panel',
    subtitle: 'Resumen del portal y estado de los módulos.',
    session: {
      heading: 'Tu sesión',
      name: 'Nombre',
      email: 'Correo',
      roles: 'Roles',
    },
    modules: {
      heading: 'Módulos',
      catalogTitle: 'Catálogo',
      catalogDescription: 'Productos, variantes, categorías, imágenes y especificaciones.',
      inventoryTitle: 'Inventario',
      inventoryDescription: 'Niveles de stock, reservas y ajustes.',
      ordersTitle: 'Pedidos',
      ordersDescription: 'Pedidos de clientes y estado de los pedidos.',
      paymentsTitle: 'Pagos',
      paymentsDescription: 'Estado e historial de pagos.',
      upcoming: 'Próximamente',
    },
  },
};

/** Arabic (`ar`) dashboard vocabulary. */
const AR_DASHBOARD: TranslationDictionary = {
  dashboard: {
    title: 'لوحة التحكم',
    subtitle: 'نظرة عامة على البوابة وحالة الوحدات.',
    session: {
      heading: 'جلستك',
      name: 'الاسم',
      email: 'البريد',
      roles: 'الأدوار',
    },
    modules: {
      heading: 'الوحدات',
      catalogTitle: 'الكتالوج',
      catalogDescription: 'المنتجات والمتغيرات والفئات والصور والمواصفات.',
      inventoryTitle: 'المخزون',
      inventoryDescription: 'مستويات المخزون والحجوزات والتعديلات.',
      ordersTitle: 'الطلبات',
      ordersDescription: 'طلبات العملاء وحالة الطلبات.',
      paymentsTitle: 'المدفوعات',
      paymentsDescription: 'حالة المدفوعات وسجلها.',
      upcoming: 'قريبًا',
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
