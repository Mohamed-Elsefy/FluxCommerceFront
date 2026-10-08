/**
 * Storefront Home feature translations for Sub-Phase 5.9 — Localization,
 * RTL & Responsive Integration.
 *
 * Feature-owned discovery-entry copy (`home` namespace) in all five
 * supported cultures (`en`/`fr`/`de`/`es`/`ar`). Per the Phase 4 ownership
 * rule, this bundle lives in the home feature: the catalog bundle stays
 * catalog-owned, so the short entry strings are intentionally duplicated
 * rather than imported across feature boundaries.
 *
 * Lookup runs through the Phase 4 `translate` engine (deterministic
 * target → `en` → key-path fallback). Pure data + pure lookup: no
 * Angular, DOM, or storage access — SSR-safe.
 */

import {
  translate,
  type Culture,
  type TranslationDictionary,
  type TranslationResources,
} from '@flux/i18n';

/** Home translation key paths owned by this feature (`home.*`). */
export const HOME_TRANSLATION_KEYS = {
  heroIndex: 'home.hero.index',
  heroTitle: 'home.hero.title',
  heroSubtitle: 'home.hero.subtitle',
  heroPrimary: 'home.hero.primary',
  heroSecondary: 'home.hero.secondary',
  heroNote: 'home.hero.note',
  perksTitle: 'home.perks.title',
  perksFastTitle: 'home.perks.fastTitle',
  perksFastText: 'home.perks.fastText',
  perksSecureTitle: 'home.perks.secureTitle',
  perksSecureText: 'home.perks.secureText',
  perksReturnTitle: 'home.perks.returnTitle',
  perksReturnText: 'home.perks.returnText',
  featuredIndex: 'home.featured.index',
  featuredTitle: 'home.featured.title',
  featuredSubtitle: 'home.featured.subtitle',
  featuredLink: 'home.featured.link',
  discoveryTitle: 'home.discovery.title',
  discoverySubtitle: 'home.discovery.subtitle',
  discoveryLink: 'home.discovery.link',
  cartTitle: 'home.cart.title',
  cartSubtitle: 'home.cart.subtitle',
  cartLink: 'home.cart.link',
} as const;

/** English (`en`) home vocabulary. Also the deterministic fallback source. */
const EN_HOME: TranslationDictionary = {
  home: {
    hero: {
      index: '01 // New drops weekly',
      title: 'Bubble up your next obsession',
      subtitle:
        'Curated tech and lifestyle picks with honest pricing, fast checkout, and tracking from cart to door.',
      primary: 'Shop the catalog',
      secondary: 'How it works',
      note: 'Free returns · Secure Stripe checkout · 5 languages',
    },
    perks: {
      title: 'Why FluxCommerce',
      fastTitle: 'Fast delivery',
      fastText: 'Tracked fulfillment from reservation to door.',
      secureTitle: 'Secure payment',
      secureText: 'Stripe-verified checkout, never stored card data.',
      returnTitle: 'Easy returns',
      returnText: 'Hassle-free returns within 30 days.',
    },
    featured: {
      index: '02 // Featured',
      title: 'This week’s pods',
      subtitle: 'A rotating shelf of staff picks. Full shelf lives in the catalog.',
      link: 'View all products',
    },
    discovery: {
      title: 'Discover products',
      subtitle: 'Browse the catalog through its categories.',
      link: 'Browse categories',
    },
    cart: {
      title: 'Your cart',
      subtitle: 'Review your selected items and continue toward checkout.',
      link: 'View your cart',
    },
  },
};

/** French (`fr`) home vocabulary. */
const FR_HOME: TranslationDictionary = {
  home: {
    hero: {
      index: '01 // Nouveautés hebdo',
      title: 'Votre prochaine obsession',
      subtitle: 'Sélection tech et lifestyle, prix honnêtes et suivi jusqu’à la porte.',
      primary: 'Voir le catalogue',
      secondary: 'Comment ça marche',
      note: 'Retours gratuits · Paiement Stripe sécurisé · 5 langues',
    },
    perks: {
      title: 'Pourquoi FluxCommerce',
      fastTitle: 'Livraison rapide',
      fastText: 'Suivi de la réservation à la porte.',
      secureTitle: 'Paiement sécurisé',
      secureText: 'Checkout Stripe vérifié, sans stockage de carte.',
      returnTitle: 'Retours faciles',
      returnText: 'Retours simples sous 30 jours.',
    },
    featured: {
      index: '02 // En vedette',
      title: 'Les pods de la semaine',
      subtitle: 'Sélection rotative. Tout le rayon est dans le catalogue.',
      link: 'Voir tous les produits',
    },
    discovery: {
      title: 'Découvrir des produits',
      subtitle: 'Parcourez le catalogue par catégories.',
      link: 'Parcourir les catégories',
    },
    cart: {
      title: 'Votre panier',
      subtitle: 'Vérifiez vos articles et continuez vers la commande.',
      link: 'Voir votre panier',
    },
  },
};

/** German (`de`) home vocabulary. */
const DE_HOME: TranslationDictionary = {
  home: {
    hero: {
      index: '01 // Neuheiten wöchentlich',
      title: 'Deine nächste Obsession',
      subtitle: 'Kuratierte Tech- und Lifestyle-Picks mit fairem Preis und Tracking.',
      primary: 'Katalog ansehen',
      secondary: 'So funktioniert es',
      note: 'Gratis-Retouren · Sichere Stripe-Zahlung · 5 Sprachen',
    },
    perks: {
      title: 'Warum FluxCommerce',
      fastTitle: 'Schneller Versand',
      fastText: 'Verfolgt von Reservierung bis Haustür.',
      secureTitle: 'Sichere Zahlung',
      secureText: 'Stripe-verifizierter Checkout ohne Kartenspeicherung.',
      returnTitle: 'Einfache Retouren',
      returnText: 'Problemlose Retouren innert 30 Tagen.',
    },
    featured: {
      index: '02 // Empfohlen',
      title: 'Pods der Woche',
      subtitle: 'Rotierende Auswahl. Das volle Regal ist im Katalog.',
      link: 'Alle Produkte ansehen',
    },
    discovery: {
      title: 'Produkte entdecken',
      subtitle: 'Stöbern Sie anhand der Kategorien im Katalog.',
      link: 'Kategorien durchsuchen',
    },
    cart: {
      title: 'Ihr Warenkorb',
      subtitle: 'Prüfen Sie Ihre Auswahl und fahren Sie mit der Bestellung fort.',
      link: 'Warenkorb ansehen',
    },
  },
};

/** Spanish (`es`) home vocabulary. */
const ES_HOME: TranslationDictionary = {
  home: {
    hero: {
      index: '01 // Novedades semanales',
      title: 'Tu próxima obsesión',
      subtitle: 'Selección tech y lifestyle con precios honestos y seguimiento.',
      primary: 'Ver el catálogo',
      secondary: 'Cómo funciona',
      note: 'Devoluciones gratis · Pago Stripe seguro · 5 idiomas',
    },
    perks: {
      title: 'Por qué FluxCommerce',
      fastTitle: 'Envío rápido',
      fastText: 'Seguimiento desde la reserva hasta la puerta.',
      secureTitle: 'Pago seguro',
      secureText: 'Checkout Stripe verificado, sin guardar tarjetas.',
      returnTitle: 'Devoluciones fáciles',
      returnText: 'Devoluciones sencillas en 30 días.',
    },
    featured: {
      index: '02 // Destacados',
      title: 'Pods de la semana',
      subtitle: 'Selección rotativa. Todo el estante está en el catálogo.',
      link: 'Ver todos los productos',
    },
    discovery: {
      title: 'Descubrir productos',
      subtitle: 'Explore el catálogo por categorías.',
      link: 'Explorar las categorías',
    },
    cart: {
      title: 'Tu cesta',
      subtitle: 'Revisa tus artículos y continúa hacia el pedido.',
      link: 'Ver tu cesta',
    },
  },
};

/** Arabic (`ar`) home vocabulary. */
const AR_HOME: TranslationDictionary = {
  home: {
    hero: {
      index: '٠١ // إصدارات أسبوعية',
      title: 'اكتشف هوسك القادم',
      subtitle: 'مختارات تقنية وأسلوب حياة بأسعار عادلة وتتبع حتى الباب.',
      primary: 'تسوق الكتالوج',
      secondary: 'كيف يعمل',
      note: 'إرجاع مجاني · دفع Stripe آمن · ٥ لغات',
    },
    perks: {
      title: 'لماذا فلوكس كومرس',
      fastTitle: 'توصيل سريع',
      fastText: 'تتبع من الحجز حتى الباب.',
      secureTitle: 'دفع آمن',
      secureText: 'دفع Stripe موثوق دون تخزين البطاقة.',
      returnTitle: 'إرجاع سهل',
      returnText: 'إرجاع ميسر خلال ٣٠ يوما.',
    },
    featured: {
      index: '٠٢ // مميز',
      title: 'مختارات الأسبوع',
      subtitle: 'رف متجدد من اختيارات الفريق. الرف الكامل في الكتالوج.',
      link: 'عرض كل المنتجات',
    },
    discovery: {
      title: 'اكتشف المنتجات',
      subtitle: 'تصفّح الكتالوج عبر الفئات.',
      link: 'تصفح الفئات',
    },
    cart: {
      title: 'سلة التسوق',
      subtitle: 'راجع المنتجات المختارة وتابع نحو إتمام الطلب.',
      link: 'عرض سلة التسوق',
    },
  },
};

/** Bundled home dictionaries keyed by supported culture. */
export const HOME_TRANSLATION_RESOURCES: TranslationResources = {
  en: EN_HOME,
  fr: FR_HOME,
  de: DE_HOME,
  es: ES_HOME,
  ar: AR_HOME,
};

/**
 * Resolves a home key to its localized string with deterministic
 * fallback: target culture → `en` → the key path itself. Never throws.
 */
export function translateHomeKey(culture: Culture, key: string): string {
  return translate(HOME_TRANSLATION_RESOURCES, culture, key);
}
