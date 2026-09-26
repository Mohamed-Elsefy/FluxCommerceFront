/**
 * Admin layout translations — shell chrome copy (`layout.*`) in all five
 * supported cultures (`en`/`fr`/`de`/`es`/`ar`).
 *
 * Covers the sidebar (landmark name, destinations), the header (context
 * title, drawer toggle, language picker), the skip link, and the account
 * area (`AuthNav` labels). Only destinations that exist have keys;
 * entries arrive with the phases that create their routes. Lookup runs
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

/** Admin layout translation key paths (`layout.*`). */
export const ADMIN_LAYOUT_TRANSLATION_KEYS = {
  navHome: 'layout.nav.home',
  navDashboard: 'layout.nav.dashboard',
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
} as const;

/** English (`en`) layout vocabulary. Also the deterministic fallback source. */
const EN_LAYOUT: TranslationDictionary = {
  layout: {
    nav: {
      home: 'Home',
      dashboard: 'Dashboard',
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
  },
};

/** French (`fr`) layout vocabulary. */
const FR_LAYOUT: TranslationDictionary = {
  layout: {
    nav: {
      home: 'Accueil',
      dashboard: 'Tableau de bord',
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
  },
};

/** German (`de`) layout vocabulary. */
const DE_LAYOUT: TranslationDictionary = {
  layout: {
    nav: {
      home: 'Startseite',
      dashboard: 'Dashboard',
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
  },
};

/** Spanish (`es`) layout vocabulary. */
const ES_LAYOUT: TranslationDictionary = {
  layout: {
    nav: {
      home: 'Inicio',
      dashboard: 'Panel',
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
  },
};

/** Arabic (`ar`) layout vocabulary. */
const AR_LAYOUT: TranslationDictionary = {
  layout: {
    nav: {
      home: 'الرئيسية',
      dashboard: 'لوحة التحكم',
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
