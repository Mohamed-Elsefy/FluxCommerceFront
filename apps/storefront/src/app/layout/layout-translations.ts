/**
 * Storefront layout translations — shell chrome copy (`layout.*`) in all
 * five supported cultures (`en`/`fr`/`de`/`es`/`ar`).
 *
 * Covers the header (brand name, navigation destinations, cart
 * quick-access, menu toggle), the language picker label, the skip link,
 * and the footer (Explore group, legal line). Short entry nouns reuse
 * the established feature wording (catalog `Catalogue`/`Katalog`/
 * `Catálogo`/`الكتالوج`, cart `Panier`/`Warenkorb`/`Cesta`, home
 * `Accueil`/`Startseite`/`Inicio`/`الرئيسية`) instead of inventing
 * parallel terms.
 *
 * Lookup runs through the Phase 4 `translate` engine (deterministic
 * target → `en` → key-path fallback, `{param}` interpolation for the
 * legal year). Pure data + pure lookup: no Angular, DOM, or storage
 * access — SSR-safe.
 */

import {
  translate,
  type Culture,
  type TranslationDictionary,
  type TranslationParams,
  type TranslationResources,
} from '@flux/i18n';

/** Layout translation key paths (`layout.*`). */
export const LAYOUT_TRANSLATION_KEYS = {
  navHome: 'layout.nav.home',
  navCatalog: 'layout.nav.catalog',
  navCart: 'layout.nav.cart',
  navMainLabel: 'layout.nav.mainLabel',
  navExploreLabel: 'layout.nav.exploreLabel',
  brandLabel: 'layout.header.brandLabel',
  menuLabel: 'layout.header.menuLabel',
  switchLabel: 'layout.switch.label',
  skipLink: 'layout.skip.link',
  exploreHeading: 'layout.footer.exploreHeading',
  legal: 'layout.footer.legal',
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
      catalog: 'Catalog',
      cart: 'Cart',
      mainLabel: 'Main',
      exploreLabel: 'Explore',
    },
    header: {
      brandLabel: 'FluxCommerce home',
      menuLabel: 'Toggle navigation',
    },
    switch: {
      label: 'Language',
    },
    skip: {
      link: 'Skip to main content',
    },
    footer: {
      exploreHeading: 'Explore',
      legal: '© {year} FluxCommerce. All rights reserved.',
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
      catalog: 'Catalogue',
      cart: 'Panier',
      mainLabel: 'Principal',
      exploreLabel: 'Explorer',
    },
    header: {
      brandLabel: 'FluxCommerce accueil',
      menuLabel: 'Basculer la navigation',
    },
    switch: {
      label: 'Langue',
    },
    skip: {
      link: 'Aller au contenu principal',
    },
    footer: {
      exploreHeading: 'Explorer',
      legal: '© {year} FluxCommerce. Tous droits réservés.',
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
      catalog: 'Katalog',
      cart: 'Warenkorb',
      mainLabel: 'Haupt',
      exploreLabel: 'Entdecken',
    },
    header: {
      brandLabel: 'FluxCommerce-Startseite',
      menuLabel: 'Navigation umschalten',
    },
    switch: {
      label: 'Sprache',
    },
    skip: {
      link: 'Zum Hauptinhalt springen',
    },
    footer: {
      exploreHeading: 'Entdecken',
      legal: '© {year} FluxCommerce. Alle Rechte vorbehalten.',
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
      catalog: 'Catálogo',
      cart: 'Cesta',
      mainLabel: 'Principal',
      exploreLabel: 'Explorar',
    },
    header: {
      brandLabel: 'FluxCommerce inicio',
      menuLabel: 'Alternar navegación',
    },
    switch: {
      label: 'Idioma',
    },
    skip: {
      link: 'Saltar al contenido principal',
    },
    footer: {
      exploreHeading: 'Explorar',
      legal: '© {year} FluxCommerce. Todos los derechos reservados.',
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
      catalog: 'الكتالوج',
      cart: 'السلة',
      mainLabel: 'الرئيسي',
      exploreLabel: 'استكشف',
    },
    header: {
      brandLabel: 'FluxCommerce الرئيسية',
      menuLabel: 'تبديل التنقل',
    },
    switch: {
      label: 'اللغة',
    },
    skip: {
      link: 'تخطَّ إلى المحتوى الرئيسي',
    },
    footer: {
      exploreHeading: 'استكشف',
      legal: '© {year} FluxCommerce. جميع الحقوق محفوظة.',
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
export const LAYOUT_TRANSLATION_RESOURCES: TranslationResources = {
  en: EN_LAYOUT,
  fr: FR_LAYOUT,
  de: DE_LAYOUT,
  es: ES_LAYOUT,
  ar: AR_LAYOUT,
};

/**
 * Resolves a layout key to its localized string with deterministic
 * fallback: target culture → `en` → the key path itself. `params` fills
 * `{placeholder}` slots (e.g. `{year}`). Never throws.
 */
export function translateLayoutKey(
  culture: Culture,
  key: string,
  params: TranslationParams = {},
): string {
  return translate(LAYOUT_TRANSLATION_RESOURCES, culture, key, params);
}
