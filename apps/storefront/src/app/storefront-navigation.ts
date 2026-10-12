/**
 * Storefront navigation destinations (app composition).
 *
 * Route paths live here — never inside the layout shells (the
 * `verify-architecture.mjs` shell boundary forbids business words in
 * shell sources, and route paths name business areas). Labels are
 * translation *keys* resolved through the layout bundle (`layout.nav.*`)
 * by the rendering shell, so destinations stay localized without
 * duplicating copy. Only routes that exist are listed here, never dead
 * links; entries arrive with the phases that create their routes
 * (Catalog with Phase 5, Cart with Phase 7).
 */

/** App-level navigation destination: a route plus its label key. */
export interface NavDestination {
  /** Translation key into the layout bundle (`layout.nav.*`). */
  readonly labelKey: string;
  /** Application route path. */
  readonly route: string;
  /** When true, the shell shows this entry to authenticated users only. */
  readonly authenticatedOnly?: boolean;
}

/** Primary header/mobile destinations (orders live in the account area). */
export const MAIN_NAV_ITEMS: readonly NavDestination[] = [
  { labelKey: 'layout.nav.home', route: '/' },
  { labelKey: 'layout.nav.products', route: '/products' },
  { labelKey: 'layout.nav.cart', route: '/cart' },
];

/** Footer Explore destinations (discovery path — no overlap with Shop). */
export const EXPLORE_NAV_ITEMS: readonly NavDestination[] = [
  { labelKey: 'layout.nav.home', route: '/' },
  { labelKey: 'layout.nav.catalog', route: '/catalog' },
];

/** Footer Shop destinations (purchase path — no overlap with Explore). */
export const SHOP_NAV_ITEMS: readonly NavDestination[] = [
  { labelKey: 'layout.nav.products', route: '/products' },
  { labelKey: 'layout.nav.cart', route: '/cart' },
  { labelKey: 'layout.nav.checkout', route: '/checkout' },
];

/** Footer Account destinations (authenticated area + entry point). */
export const ACCOUNT_NAV_ITEMS: readonly NavDestination[] = [
  { labelKey: 'layout.nav.profile', route: '/account/profile' },
  { labelKey: 'layout.nav.orders', route: '/account/orders' },
  { labelKey: 'layout.nav.payments', route: '/payment/mine' },
  { labelKey: 'layout.nav.login', route: '/login' },
];
