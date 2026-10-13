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
  heroImageAlt: 'home.hero.imageAlt',
  heroNote: 'home.hero.note',
  perksTitle: 'home.perks.title',
  perksIndex: 'home.perks.index',
  perksFastTitle: 'home.perks.fastTitle',
  perksFastText: 'home.perks.fastText',
  perksSecureTitle: 'home.perks.secureTitle',
  perksSecureText: 'home.perks.secureText',
  perksReturnTitle: 'home.perks.returnTitle',
  perksReturnText: 'home.perks.returnText',
  perksLangTitle: 'home.perks.langTitle',
  perksLangText: 'home.perks.langText',
  featuredIndex: 'home.featured.index',
  featuredTitle: 'home.featured.title',
  featuredSubtitle: 'home.featured.subtitle',
  featuredLink: 'home.featured.link',
  categoriesIndex: 'home.categories.index',
  categoriesTitle: 'home.categories.title',
  categoriesSubtitle: 'home.categories.subtitle',
  categoriesLink: 'home.categories.link',
  shelfIndex: 'home.shelf.index',
  shelfTitle: 'home.shelf.title',
  shelfSubtitle: 'home.shelf.subtitle',
  shelfLink: 'home.shelf.link',
  shelfChipAll: 'home.shelf.chipAll',
  shelfChipNewest: 'home.shelf.chipNewest',
  shelfChipAz: 'home.shelf.chipAz',
  ctaIndex: 'home.cta.index',
  ctaTitle: 'home.cta.title',
  ctaShopTitle: 'home.cta.shopTitle',
  ctaShopText: 'home.cta.shopText',
  ctaShopLink: 'home.cta.shopLink',
  ctaTrackTitle: 'home.cta.trackTitle',
  ctaTrackText: 'home.cta.trackText',
  ctaTrackLink: 'home.cta.trackLink',
  ctaAccountTitle: 'home.cta.accountTitle',
  ctaAccountText: 'home.cta.accountText',
  ctaAccountLink: 'home.cta.accountLink',
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
      primary: 'Shop products',
      imageAlt: 'A vibrant showcase of featured store products',
      note: 'Free returns · Secure Stripe checkout · 5 languages',
    },
    perks: {
      title: 'Why FluxCommerce',
      index: '05 // Why us',
      fastTitle: 'Fast delivery',
      fastText: 'Tracked fulfillment from reservation to door.',
      secureTitle: 'Secure payment',
      secureText: 'Stripe-verified checkout, never stored card data.',
      returnTitle: 'Easy returns',
      returnText: 'Hassle-free returns within 30 days.',
      langTitle: '5 languages',
      langText: 'Full storefront in English, French, German, Spanish, and Arabic.',
    },
    featured: {
      index: '02 // Featured',
      title: 'This week’s pods',
      subtitle: 'A rotating shelf of staff picks. Full shelf lives in the catalog.',
      link: 'View all products',
    },
    categories: {
      index: '02 // Categories',
      title: 'Featured categories',
      subtitle: 'Start from a shelf that fits your mood, then drill into products.',
      link: 'Browse all categories',
    },
    shelf: {
      index: '03 // The shelf',
      title: 'Products, your way',
      subtitle: 'The full listing with search, filters, and sorting — pick a shortcut.',
      link: 'Open the full shelf',
      chipAll: 'All products',
      chipNewest: 'Newest first',
      chipAz: 'A to Z',
    },
    cta: {
      index: '04 // Next steps',
      title: 'Where to next?',
      shopTitle: 'Start shopping',
      shopText: 'Search the shelf and build your cart.',
      shopLink: 'Shop products',
      trackTitle: 'Track your order',
      trackText: 'Follow confirmed orders from reservation to door.',
      trackLink: 'View my orders',
      accountTitle: 'Your account',
      accountText: 'Profile, orders, and payments in one place.',
      accountLink: 'Open my account',
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
      primary: 'Voir les produits',
      imageAlt: 'Une vitrine éclatante des produits en vedette',
      note: 'Retours gratuits · Paiement Stripe sécurisé · 5 langues',
    },
    perks: {
      title: 'Pourquoi FluxCommerce',
      index: '05 // Pourquoi nous',
      fastTitle: 'Livraison rapide',
      fastText: 'Suivi de la réservation à la porte.',
      secureTitle: 'Paiement sécurisé',
      secureText: 'Checkout Stripe vérifié, sans stockage de carte.',
      returnTitle: 'Retours faciles',
      returnText: 'Retours simples sous 30 jours.',
      langTitle: '5 langues',
      langText: 'Boutique complète en français, anglais, allemand, espagnol et arabe.',
    },
    featured: {
      index: '02 // En vedette',
      title: 'Les pods de la semaine',
      subtitle: 'Sélection rotative. Tout le rayon est dans le catalogue.',
      link: 'Voir tous les produits',
    },
    categories: {
      index: '02 // Catégories',
      title: 'Catégories en vedette',
      subtitle: 'Partez d’un rayon selon votre envie, puis explorez les produits.',
      link: 'Voir toutes les catégories',
    },
    shelf: {
      index: '03 // Le rayon',
      title: 'Les produits, à votre façon',
      subtitle: 'Tout le rayon avec recherche, filtres et tri — choisissez un raccourci.',
      link: 'Ouvrir tout le rayon',
      chipAll: 'Tous les produits',
      chipNewest: 'Nouveautés d’abord',
      chipAz: 'De A à Z',
    },
    cta: {
      index: '04 // Prochaines étapes',
      title: 'Et maintenant ?',
      shopTitle: 'Commencer vos achats',
      shopText: 'Cherchez dans le rayon et remplissez votre panier.',
      shopLink: 'Voir les produits',
      trackTitle: 'Suivre votre commande',
      trackText: 'Suivez vos commandes de la réservation à la porte.',
      trackLink: 'Voir mes commandes',
      accountTitle: 'Votre compte',
      accountText: 'Profil, commandes et paiements au même endroit.',
      accountLink: 'Ouvrir mon compte',
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
      primary: 'Produkte ansehen',
      imageAlt: 'Eine lebendige Schau ausgewählter Produkte',
      note: 'Gratis-Retouren · Sichere Stripe-Zahlung · 5 Sprachen',
    },
    perks: {
      title: 'Warum FluxCommerce',
      index: '05 // Warum wir',
      fastTitle: 'Schneller Versand',
      fastText: 'Verfolgt von Reservierung bis Haustür.',
      secureTitle: 'Sichere Zahlung',
      secureText: 'Stripe-verifizierter Checkout ohne Kartenspeicherung.',
      returnTitle: 'Einfache Retouren',
      returnText: 'Problemlose Retouren innert 30 Tagen.',
      langTitle: '5 Sprachen',
      langText: 'Kompletter Shop auf Deutsch, Englisch, Französisch, Spanisch und Arabisch.',
    },
    featured: {
      index: '02 // Empfohlen',
      title: 'Pods der Woche',
      subtitle: 'Rotierende Auswahl. Das volle Regal ist im Katalog.',
      link: 'Alle Produkte ansehen',
    },
    categories: {
      index: '02 // Kategorien',
      title: 'Empfohlene Kategorien',
      subtitle: 'Starten Sie mit einem Regal nach Stimmung und stöbern Sie weiter.',
      link: 'Alle Kategorien ansehen',
    },
    shelf: {
      index: '03 // Das Regal',
      title: 'Produkte nach Ihrer Art',
      subtitle: 'Das volle Regal mit Suche, Filtern und Sortierung — wählen Sie.',
      link: 'Volles Regal öffnen',
      chipAll: 'Alle Produkte',
      chipNewest: 'Neueste zuerst',
      chipAz: 'A bis Z',
    },
    cta: {
      index: '04 // Nächste Schritte',
      title: 'Wie geht es weiter?',
      shopTitle: 'Jetzt einkaufen',
      shopText: 'Durchsuchen Sie das Regal und füllen Sie den Warenkorb.',
      shopLink: 'Produkte ansehen',
      trackTitle: 'Bestellung verfolgen',
      trackText: 'Verfolgen Sie Bestellungen bis zur Haustür.',
      trackLink: 'Meine Bestellungen',
      accountTitle: 'Ihr Konto',
      accountText: 'Profil, Bestellungen und Zahlungen an einem Ort.',
      accountLink: 'Mein Konto öffnen',
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
      primary: 'Ver productos',
      imageAlt: 'Una muestra vibrante de los productos destacados',
      note: 'Devoluciones gratis · Pago Stripe seguro · 5 idiomas',
    },
    perks: {
      title: 'Por qué FluxCommerce',
      index: '05 // Por qué nosotros',
      fastTitle: 'Envío rápido',
      fastText: 'Seguimiento desde la reserva hasta la puerta.',
      secureTitle: 'Pago seguro',
      secureText: 'Checkout Stripe verificado, sin guardar tarjetas.',
      returnTitle: 'Devoluciones fáciles',
      returnText: 'Devoluciones sencillas en 30 días.',
      langTitle: '5 idiomas',
      langText: 'Tienda completa en español, inglés, francés, alemán y árabe.',
    },
    featured: {
      index: '02 // Destacados',
      title: 'Pods de la semana',
      subtitle: 'Selección rotativa. Todo el estante está en el catálogo.',
      link: 'Ver todos los productos',
    },
    categories: {
      index: '02 // Categorías',
      title: 'Categorías destacadas',
      subtitle: 'Empiece por un estante según su ánimo y siga explorando.',
      link: 'Ver todas las categorías',
    },
    shelf: {
      index: '03 // El estante',
      title: 'Productos a su gusto',
      subtitle: 'Todo el estante con búsqueda, filtros y orden — elija un atajo.',
      link: 'Abrir todo el estante',
      chipAll: 'Todos los productos',
      chipNewest: 'Novedades primero',
      chipAz: 'De la A a la Z',
    },
    cta: {
      index: '04 // Próximos pasos',
      title: '¿Y ahora qué?',
      shopTitle: 'Empezar a comprar',
      shopText: 'Busque en el estante y llene su cesta.',
      shopLink: 'Ver productos',
      trackTitle: 'Rastrear su pedido',
      trackText: 'Siga sus pedidos hasta la puerta.',
      trackLink: 'Ver mis pedidos',
      accountTitle: 'Su cuenta',
      accountText: 'Perfil, pedidos y pagos en un solo lugar.',
      accountLink: 'Abrir mi cuenta',
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
      primary: 'تسوق المنتجات',
      imageAlt: 'عرض نابض لأبرز منتجات المتجر',
      note: 'إرجاع مجاني · دفع Stripe آمن · ٥ لغات',
    },
    perks: {
      title: 'لماذا فلوكس كومرس',
      index: '٠٥ // لماذا نحن',
      fastTitle: 'توصيل سريع',
      fastText: 'تتبع من الحجز حتى الباب.',
      secureTitle: 'دفع آمن',
      secureText: 'دفع Stripe موثوق دون تخزين البطاقة.',
      returnTitle: 'إرجاع سهل',
      returnText: 'إرجاع ميسر خلال ٣٠ يوما.',
      langTitle: '٥ لغات',
      langText: 'متجر كامل بالعربية والإنجليزية والفرنسية والألمانية والإسبانية.',
    },
    featured: {
      index: '٠٢ // مميز',
      title: 'مختارات الأسبوع',
      subtitle: 'رف متجدد من اختيارات الفريق. الرف الكامل في الكتالوج.',
      link: 'عرض كل المنتجات',
    },
    categories: {
      index: '٠٢ // الفئات',
      title: 'فئات مميزة',
      subtitle: 'ابدأ من رف يناسب مزاجك ثم تعمق في المنتجات.',
      link: 'عرض كل الفئات',
    },
    shelf: {
      index: '٠٣ // الرف',
      title: 'المنتجات على طريقتك',
      subtitle: 'الرف الكامل مع بحث وفلاتر وترتيب — اختر اختصاراً.',
      link: 'فتح الرف الكامل',
      chipAll: 'كل المنتجات',
      chipNewest: 'الأحدث أولاً',
      chipAz: 'من الألف إلى الياء',
    },
    cta: {
      index: '٠٤ // خطوات تالية',
      title: 'إلى أين بعد؟',
      shopTitle: 'ابدأ التسوق',
      shopText: 'ابحث في الرف واملأ سلتك.',
      shopLink: 'تسوق المنتجات',
      trackTitle: 'تتبع طلبك',
      trackText: 'تابع طلباتك من الحجز حتى الباب.',
      trackLink: 'عرض طلباتي',
      accountTitle: 'حسابك',
      accountText: 'الملف والطلبات والمدفوعات في مكان واحد.',
      accountLink: 'فتح حسابي',
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
