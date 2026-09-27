/**
 * Admin layout translations — shell chrome copy (`layout.*`) in all five
 * supported cultures (`en`/`fr`/`de`/`es`/`ar`).
 *
 * Covers the sidebar (landmark name, destinations), the header (context
 * title, drawer toggle, language picker), the skip link, the account
 * area (`AuthNav` labels), and the standalone denial/not-found pages.
 * Only destinations that exist have keys; entries arrive with the
 * phases that create their routes. Lookup runs through the Phase 4
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

/** Admin layout translation key paths (`layout.*`). */
export const ADMIN_LAYOUT_TRANSLATION_KEYS = {
  navHome: 'layout.nav.home',
  navDashboard: 'layout.nav.dashboard',
  navCatalog: 'layout.nav.catalog',
  navProducts: 'layout.nav.products',
  navCategories: 'layout.nav.categories',
  navInventory: 'layout.nav.inventory',
  navStock: 'layout.nav.stock',
  navReservations: 'layout.nav.reservations',
  navAdjustments: 'layout.nav.adjustments',
  navSidebarLabel: 'layout.nav.sidebarLabel',
  headerContext: 'layout.header.context',
  headerMenuLabel: 'layout.header.menuLabel',
  switchLabel: 'layout.switch.label',
  skipLink: 'layout.skip.link',
  brandLabel: 'layout.brand.label',
  authChecking: 'layout.auth.checking',
  authNavLabel: 'layout.auth.navLabel',
  authLogin: 'layout.auth.login',
  authRegister: 'layout.auth.register',
  authAccount: 'layout.auth.account',
  authLogout: 'layout.auth.logout',
  authLoggingOut: 'layout.auth.loggingOut',
  forbiddenTitle: 'layout.forbidden.title',
  forbiddenMessage: 'layout.forbidden.message',
  forbiddenBack: 'layout.forbidden.back',
  notFoundTitle: 'layout.notFound.title',
  notFoundMessage: 'layout.notFound.message',
  notFoundBack: 'layout.notFound.back',
  drawerCloseOverlay: 'layout.drawer.closeOverlay',
  notificationsLabel: 'layout.notifications.label',
  notificationsDismiss: 'layout.notifications.dismiss',
} as const;

/** English (`en`) layout vocabulary. Also the deterministic fallback source. */
const EN_LAYOUT: TranslationDictionary = {
  layout: {
    nav: {
      home: 'Home',
      dashboard: 'Dashboard',
      catalog: 'Catalog',
      products: 'Products',
      categories: 'Categories',
      inventory: 'Inventory',
      stock: 'Stock',
      reservations: 'Reservations',
      adjustments: 'Adjustments',
      sidebarLabel: 'Admin',
    },
    header: {
      context: 'FluxCommerce Admin',
      menuLabel: 'Toggle navigation',
    },
    switch: {
      label: 'Language',
    },
    skip: {
      link: 'Skip to main content',
    },
    brand: {
      label: 'FluxCommerce Admin',
    },
    auth: {
      checking: 'Checking session…',
      navLabel: 'Account',
      login: 'Login',
      register: 'Register',
      account: 'Account',
      logout: 'Logout',
      loggingOut: 'Signing out…',
    },
    forbidden: {
      title: 'Access denied',
      message: 'You do not have permission to view this page.',
      back: 'Back to home',
    },
    notFound: {
      title: 'Page not found',
      message: 'The page you requested does not exist.',
      back: 'Back to home',
    },
    drawer: {
      closeOverlay: 'Close navigation',
    },
    notifications: {
      label: 'Notifications',
      dismiss: 'Dismiss',
    },
  },
};

/** French (`fr`) layout vocabulary. */
const FR_LAYOUT: TranslationDictionary = {
  layout: {
    nav: {
      home: 'Accueil',
      dashboard: 'Tableau de bord',
      catalog: 'Catalogue',
      products: 'Produits',
      categories: 'Catégories',
      inventory: 'Inventaire',
      stock: 'Stock',
      reservations: 'Réservations',
      adjustments: 'Ajustements',
      sidebarLabel: 'Admin',
    },
    header: {
      context: 'FluxCommerce Admin',
      menuLabel: 'Basculer la navigation',
    },
    switch: {
      label: 'Langue',
    },
    skip: {
      link: 'Aller au contenu principal',
    },
    brand: {
      label: 'FluxCommerce Admin',
    },
    auth: {
      checking: 'Vérification de la session…',
      navLabel: 'Compte',
      login: 'Se connecter',
      register: "S'inscrire",
      account: 'Compte',
      logout: 'Se déconnecter',
      loggingOut: 'Déconnexion…',
    },
    forbidden: {
      title: 'Accès refusé',
      message: "Vous n'avez pas l'autorisation de voir cette page.",
      back: "Retour à l'accueil",
    },
    notFound: {
      title: 'Page introuvable',
      message: "La page demandée n'existe pas.",
      back: "Retour à l'accueil",
    },
    drawer: {
      closeOverlay: 'Fermer la navigation',
    },
    notifications: {
      label: 'Notifications',
      dismiss: 'Ignorer',
    },
  },
};

/** German (`de`) layout vocabulary. */
const DE_LAYOUT: TranslationDictionary = {
  layout: {
    nav: {
      home: 'Startseite',
      dashboard: 'Dashboard',
      catalog: 'Katalog',
      products: 'Produkte',
      categories: 'Kategorien',
      inventory: 'Bestand',
      stock: 'Bestand',
      reservations: 'Reservierungen',
      adjustments: 'Anpassungen',
      sidebarLabel: 'Admin',
    },
    header: {
      context: 'FluxCommerce Admin',
      menuLabel: 'Navigation umschalten',
    },
    switch: {
      label: 'Sprache',
    },
    skip: {
      link: 'Zum Hauptinhalt springen',
    },
    brand: {
      label: 'FluxCommerce Admin',
    },
    auth: {
      checking: 'Sitzung wird geprüft…',
      navLabel: 'Konto',
      login: 'Anmelden',
      register: 'Registrieren',
      account: 'Konto',
      logout: 'Abmelden',
      loggingOut: 'Abmelden…',
    },
    forbidden: {
      title: 'Zugriff verweigert',
      message: 'Sie haben keine Berechtigung, diese Seite zu sehen.',
      back: 'Zurück zur Startseite',
    },
    notFound: {
      title: 'Seite nicht gefunden',
      message: 'Die angeforderte Seite existiert nicht.',
      back: 'Zurück zur Startseite',
    },
    drawer: {
      closeOverlay: 'Navigation schließen',
    },
    notifications: {
      label: 'Mitteilungen',
      dismiss: 'Schließen',
    },
  },
};

/** Spanish (`es`) layout vocabulary. */
const ES_LAYOUT: TranslationDictionary = {
  layout: {
    nav: {
      home: 'Inicio',
      dashboard: 'Panel',
      catalog: 'Catálogo',
      products: 'Productos',
      categories: 'Categorías',
      inventory: 'Inventario',
      stock: 'Stock',
      reservations: 'Reservas',
      adjustments: 'Ajustes',
      sidebarLabel: 'Admin',
    },
    header: {
      context: 'FluxCommerce Admin',
      menuLabel: 'Alternar navegación',
    },
    switch: {
      label: 'Idioma',
    },
    skip: {
      link: 'Saltar al contenido principal',
    },
    brand: {
      label: 'FluxCommerce Admin',
    },
    auth: {
      checking: 'Comprobando la sesión…',
      navLabel: 'Cuenta',
      login: 'Iniciar sesión',
      register: 'Registrarse',
      account: 'Cuenta',
      logout: 'Cerrar sesión',
      loggingOut: 'Cerrando sesión…',
    },
    forbidden: {
      title: 'Acceso denegado',
      message: 'No tienes permiso para ver esta página.',
      back: 'Volver al inicio',
    },
    notFound: {
      title: 'Página no encontrada',
      message: 'La página solicitada no existe.',
      back: 'Volver al inicio',
    },
    drawer: {
      closeOverlay: 'Cerrar la navegación',
    },
    notifications: {
      label: 'Notificaciones',
      dismiss: 'Descartar',
    },
  },
};

/** Arabic (`ar`) layout vocabulary. */
const AR_LAYOUT: TranslationDictionary = {
  layout: {
    nav: {
      home: 'الرئيسية',
      dashboard: 'لوحة التحكم',
      catalog: 'الكتالوج',
      products: 'المنتجات',
      categories: 'الفئات',
      inventory: 'المخزون',
      stock: 'المخزون',
      reservations: 'الحجوزات',
      adjustments: 'التعديلات',
      sidebarLabel: 'الإدارة',
    },
    header: {
      context: 'إدارة FluxCommerce',
      menuLabel: 'تبديل التنقل',
    },
    switch: {
      label: 'اللغة',
    },
    skip: {
      link: 'تخطَّ إلى المحتوى الرئيسي',
    },
    brand: {
      label: 'إدارة FluxCommerce',
    },
    auth: {
      checking: 'جارٍ التحقق من الجلسة…',
      navLabel: 'الحساب',
      login: 'تسجيل الدخول',
      register: 'إنشاء حساب',
      account: 'الحساب',
      logout: 'تسجيل الخروج',
      loggingOut: 'جارٍ تسجيل الخروج…',
    },
    forbidden: {
      title: 'تم الرفض',
      message: 'ليس لديك إذن لعرض هذه الصفحة.',
      back: 'عودة للرئيسية',
    },
    notFound: {
      title: 'الصفحة غير موجودة',
      message: 'الصفحة المطلوبة غير موجودة.',
      back: 'عودة للرئيسية',
    },
    drawer: {
      closeOverlay: 'إغلاق التنقل',
    },
    notifications: {
      label: 'الإشعارات',
      dismiss: 'تجاهل',
    },
  },
};

/** Bundled layout dictionaries keyed by supported culture. */
export const ADMIN_LAYOUT_TRANSLATION_RESOURCES: TranslationResources = {
  en: EN_LAYOUT,
  fr: FR_LAYOUT,
  de: DE_LAYOUT,
  es: ES_LAYOUT,
  ar: AR_LAYOUT,
};

/**
 * Resolves an admin layout key to its localized string with deterministic
 * fallback: target culture → `en` → the key path itself. Never throws.
 */
export function translateAdminLayoutKey(
  culture: Culture,
  key: string,
  params: TranslationParams = {},
): string {
  return translate(ADMIN_LAYOUT_TRANSLATION_RESOURCES, culture, key, params);
}
