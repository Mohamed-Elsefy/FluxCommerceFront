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
  navProducts: 'layout.nav.products',
  navCart: 'layout.nav.cart',
  navOrders: 'layout.nav.orders',
  navCheckout: 'layout.nav.checkout',
  navProfile: 'layout.nav.profile',
  navPayments: 'layout.nav.payments',
  navLogin: 'layout.nav.login',
  navMainLabel: 'layout.nav.mainLabel',
  navExploreLabel: 'layout.nav.exploreLabel',
  brandLabel: 'layout.header.brandLabel',
  menuLabel: 'layout.header.menuLabel',
  accountMenuLabel: 'layout.header.accountMenuLabel',
  avatarLabel: 'layout.header.avatarLabel',
  searchLabel: 'layout.search.label',
  searchPlaceholder: 'layout.search.placeholder',
  searchButton: 'layout.search.button',
  switchLabel: 'layout.switch.label',
  skipLink: 'layout.skip.link',
  exploreHeading: 'layout.footer.exploreHeading',
  shopHeading: 'layout.footer.shopHeading',
  accountHeading: 'layout.footer.accountHeading',
  personalHeading: 'layout.footer.personalHeading',
  personalPlaceholder: 'layout.footer.personalPlaceholder',
  tagline: 'layout.footer.tagline',
  description: 'layout.footer.description',
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
      products: 'Products',
      cart: 'Cart',
      orders: 'Orders',
      checkout: 'Checkout',
      profile: 'Profile',
      payments: 'Payments',
      login: 'Login',
      mainLabel: 'Main',
      exploreLabel: 'Explore',
    },
    header: {
      brandLabel: 'FluxCommerce home',
      menuLabel: 'Toggle navigation',
      accountMenuLabel: 'Account menu',
      avatarLabel: 'Open account menu',
    },
    search: {
      label: 'Search products',
      placeholder: 'Search products…',
      button: 'Search',
    },
    switch: {
      label: 'Language',
    },
    skip: {
      link: 'Skip to main content',
    },
    footer: {
      exploreHeading: 'Explore',
      shopHeading: 'Shop',
      accountHeading: 'Account',
      personalHeading: 'About',
      personalPlaceholder: 'Personal info coming soon.',
      tagline: 'Bubble up your next obsession.',
      description:
        'An enterprise-grade storefront demo: curated products, honest pricing, and tracked checkout from cart to door.',
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
      products: 'Produits',
      cart: 'Panier',
      orders: 'Commandes',
      checkout: 'Commande',
      profile: 'Profil',
      payments: 'Paiements',
      login: 'Connexion',
      mainLabel: 'Principal',
      exploreLabel: 'Explorer',
    },
    header: {
      brandLabel: 'FluxCommerce accueil',
      menuLabel: 'Basculer la navigation',
      accountMenuLabel: 'Menu du compte',
      avatarLabel: 'Ouvrir le menu du compte',
    },
    search: {
      label: 'Rechercher des produits',
      placeholder: 'Rechercher des produits…',
      button: 'Rechercher',
    },
    switch: {
      label: 'Langue',
    },
    skip: {
      link: 'Aller au contenu principal',
    },
    footer: {
      exploreHeading: 'Explorer',
      shopHeading: 'Boutique',
      accountHeading: 'Compte',
      personalHeading: 'À propos',
      personalPlaceholder: 'Informations personnelles bientôt disponibles.',
      tagline: 'Votre prochaine obsession.',
      description:
        'Une vitrine de niveau entreprise : produits sélectionnés, prix honnêtes et suivi jusqu’à la porte.',
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
      products: 'Produkte',
      cart: 'Warenkorb',
      orders: 'Bestellungen',
      checkout: 'Kasse',
      profile: 'Profil',
      payments: 'Zahlungen',
      login: 'Anmelden',
      mainLabel: 'Haupt',
      exploreLabel: 'Entdecken',
    },
    header: {
      brandLabel: 'FluxCommerce-Startseite',
      menuLabel: 'Navigation umschalten',
      accountMenuLabel: 'Kontomenü',
      avatarLabel: 'Kontomenü öffnen',
    },
    search: {
      label: 'Produkte suchen',
      placeholder: 'Produkte suchen…',
      button: 'Suchen',
    },
    switch: {
      label: 'Sprache',
    },
    skip: {
      link: 'Zum Hauptinhalt springen',
    },
    footer: {
      exploreHeading: 'Entdecken',
      shopHeading: 'Shop',
      accountHeading: 'Konto',
      personalHeading: 'Über',
      personalPlaceholder: 'Persönliche Infos folgen in Kürze.',
      tagline: 'Deine nächste Obsession.',
      description:
        'Ein Storefront auf Enterprise-Niveau: kuratierte Produkte, faire Preise und Verfolgung bis zur Haustür.',
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
      products: 'Productos',
      cart: 'Cesta',
      orders: 'Pedidos',
      checkout: 'Pagar',
      profile: 'Perfil',
      payments: 'Pagos',
      login: 'Entrar',
      mainLabel: 'Principal',
      exploreLabel: 'Explorar',
    },
    header: {
      brandLabel: 'FluxCommerce inicio',
      menuLabel: 'Alternar navegación',
      accountMenuLabel: 'Menú de cuenta',
      avatarLabel: 'Abrir menú de cuenta',
    },
    search: {
      label: 'Buscar productos',
      placeholder: 'Buscar productos…',
      button: 'Buscar',
    },
    switch: {
      label: 'Idioma',
    },
    skip: {
      link: 'Saltar al contenido principal',
    },
    footer: {
      exploreHeading: 'Explorar',
      shopHeading: 'Tienda',
      accountHeading: 'Cuenta',
      personalHeading: 'Acerca de',
      personalPlaceholder: 'Información personal próximamente.',
      tagline: 'Tu próxima obsesión.',
      description:
        'Un escaparate de nivel empresarial: productos seleccionados, precios honestos y seguimiento hasta la puerta.',
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
      products: 'المنتجات',
      cart: 'السلة',
      orders: 'الطلبات',
      checkout: 'إتمام الطلب',
      profile: 'الملف الشخصي',
      payments: 'المدفوعات',
      login: 'تسجيل الدخول',
      mainLabel: 'الرئيسي',
      exploreLabel: 'استكشف',
    },
    header: {
      brandLabel: 'FluxCommerce الرئيسية',
      menuLabel: 'تبديل التنقل',
      accountMenuLabel: 'قائمة الحساب',
      avatarLabel: 'فتح قائمة الحساب',
    },
    search: {
      label: 'ابحث في المنتجات',
      placeholder: 'ابحث في المنتجات…',
      button: 'بحث',
    },
    switch: {
      label: 'اللغة',
    },
    skip: {
      link: 'تخطَّ إلى المحتوى الرئيسي',
    },
    footer: {
      exploreHeading: 'استكشف',
      shopHeading: 'التسوق',
      accountHeading: 'الحساب',
      personalHeading: 'نبذة',
      personalPlaceholder: 'المعلومات الشخصية ستتوفر قريباً.',
      tagline: 'اكتشف هوسك القادم.',
      description:
        'واجهة متجر بمستوى المؤسسات: منتجات مختارة وأسعار عادلة وتتبع من السلة حتى الباب.',
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
