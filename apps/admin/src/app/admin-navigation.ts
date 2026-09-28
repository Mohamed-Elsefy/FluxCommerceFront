/**
 * Admin navigation destinations (app composition) for Sub-Phase 12.3 —
 * Admin Navigation & Sidebar.
 *
 * Route paths live here — never inside the layout shell (presentation
 * stays business-agnostic) and never as dead links: only routes that
 * exist are listed, and entries arrive with the phases that create
 * their routes. Labels are translation *keys* resolved through the
 * admin layout bundle (`layout.nav.*`) by the composing shell, so
 * destinations stay localized without duplicating copy.
 *
 * Extensibility for later phases: entries may carry a decorative icon
 * glyph (rendered through the shared `flux-icon` slot), an optional
 * role allow-list (role-aware visibility), and optional nested children
 * (grouped sections whose own entries arrive with their phases).
 */

/** Known portal roles (mirrors the backend role model verbatim). */
export const ADMIN_PORTAL_ROLES = ['Admin', 'SuperAdmin'] as const;

/** Admin navigation destination: a route plus its label key. */
export interface AdminDestination {
  /** Translation key into the admin layout bundle (`layout.nav.*`). */
  readonly labelKey: string;
  /** Application route path. `undefined` renders a group label for nested sections. */
  readonly route?: string;
  /** Decorative icon glyph (shared `flux-icon` slot; labels carry meaning). */
  readonly icon?: string;
  /**
   * Role allow-list (OR semantics). `undefined` means visible to every
   * portal user; otherwise the user needs at least one listed role.
   */
  readonly roles?: readonly string[];
  /** Nested destinations (rendered as a grouped subsection). */
  readonly children?: readonly AdminDestination[];
}

/**
 * Sidebar destinations — only routes that exist. The catalog group grows
 * with the slices that create their routes (products in 13.3, categories
 * in 13.5); the inventory group grows the same way (stock, reservations,
 * and adjustments in 13.9–13.10); the orders group grows with the slices
 * that create their routes (list in 14.3, details in 14.5).
 */
export const ADMIN_NAV_ITEMS: readonly AdminDestination[] = [
  { labelKey: 'layout.nav.home', route: '/', icon: '⌂' },
  { labelKey: 'layout.nav.dashboard', route: '/dashboard', icon: '▦' },
  {
    labelKey: 'layout.nav.catalog',
    route: '/catalog',
    icon: '▤',
    children: [
      { labelKey: 'layout.nav.products', route: '/catalog/products' },
      { labelKey: 'layout.nav.categories', route: '/catalog/categories' },
    ],
  },
  {
    labelKey: 'layout.nav.inventory',
    route: '/inventory',
    icon: '▣',
    children: [
      { labelKey: 'layout.nav.stock', route: '/inventory/stock' },
      { labelKey: 'layout.nav.reservations', route: '/inventory/reservations' },
      { labelKey: 'layout.nav.adjustments', route: '/inventory/adjustments' },
    ],
  },
  {
    labelKey: 'layout.nav.orders',
    route: '/orders',
    icon: '▨',
  },
];

/**
 * Role-aware visibility: keeps entries with no allow-list and entries
 * where the user holds at least one listed role. Children inherit the
 * outcome — a hidden group hides its whole subsection.
 */
export function visibleDestinations(
  items: readonly AdminDestination[],
  roles: readonly string[],
): readonly AdminDestination[] {
  return items.flatMap((item) => {
    if (item.roles !== undefined && !item.roles.some((role) => roles.includes(role))) {
      return [];
    }
    const children =
      item.children === undefined ? undefined : visibleDestinations(item.children, roles);
    return [{ ...item, children }];
  });
}
