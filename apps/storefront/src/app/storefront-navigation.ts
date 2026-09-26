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
}

/** Primary header/mobile destinations. */
export const MAIN_NAV_ITEMS: readonly NavDestination[] = [
  { labelKey: 'layout.nav.home', route: '/' },
  { labelKey: 'layout.nav.catalog', route: '/catalog' },
];

/** Footer Explore destinations (mirrors the header). */
export const EXPLORE_NAV_ITEMS: readonly NavDestination[] = [
  { labelKey: 'layout.nav.home', route: '/' },
  { labelKey: 'layout.nav.catalog', route: '/catalog' },
  { labelKey: 'layout.nav.cart', route: '/cart' },
];

/** Header quick-access cart destination. */
export const CART_NAV_ITEM: NavDestination = {
  labelKey: 'layout.nav.cart',
  route: '/cart',
};
