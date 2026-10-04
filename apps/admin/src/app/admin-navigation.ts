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
  /**
   * Permission allow-list (OR semantics, Supplement S1). `undefined` means
   * no permission check; otherwise the user needs at least one listed
   * permission — unless `SuperAdmin`, which bypasses every permission gate
   * (backend supremacy) while holding no permissions itself.
   */
  readonly permissions?: readonly string[];
  /** Nested destinations (rendered as a grouped subsection). */
  readonly children?: readonly AdminDestination[];
}

/**
 * Sidebar destinations — only routes that exist. The catalog group grows
 * with the slices that create their routes (products in 13.3, categories
 * in 13.5); the inventory group grows the same way (stock, reservations,
 * adjustments, and item creation); the orders group grows with the
 * slices that create their routes (list in 14.3; details arrive
 * deep-linked in 14.5 with no nav entry — like catalog details); the
 * payments group arrives with Supplement S1.9 (list with a deep-linked
 * details page). Details pages (`:id` segments) stay deep-link-only.
 * The portal root (`/`) redirects to `/dashboard`, so no home entry
 * ships — the dashboard is the landing page.
 */
export const ADMIN_NAV_ITEMS: readonly AdminDestination[] = [
  {
    labelKey: 'layout.nav.dashboard',
    route: '/dashboard',
    icon: '▦',
    permissions: ['dashboard.read'],
  },
  {
    labelKey: 'layout.nav.catalog',
    route: '/catalog',
    icon: '▤',
    permissions: ['catalog.manage'],
    children: [
      { labelKey: 'layout.nav.products', route: '/catalog/products' },
      { labelKey: 'layout.nav.categories', route: '/catalog/categories' },
    ],
  },
  {
    labelKey: 'layout.nav.inventory',
    route: '/inventory',
    icon: '▣',
    permissions: ['inventory.read'],
    children: [
      { labelKey: 'layout.nav.stock', route: '/inventory/stock' },
      { labelKey: 'layout.nav.reservations', route: '/inventory/reservations' },
      {
        labelKey: 'layout.nav.adjustments',
        route: '/inventory/adjustments',
        permissions: ['inventory.manage'],
      },
      {
        labelKey: 'layout.nav.newItem',
        route: '/inventory/new',
        permissions: ['inventory.manage'],
      },
    ],
  },
  {
    labelKey: 'layout.nav.orders',
    route: '/orders',
    icon: '▨',
    permissions: ['orders.read'],
    children: [{ labelKey: 'layout.nav.ordersList', route: '/orders/list' }],
  },
  {
    labelKey: 'layout.nav.payments',
    route: '/payments',
    icon: '◈',
    permissions: ['payments.read', 'payments.stats'],
    children: [{ labelKey: 'layout.nav.paymentsList', route: '/payments/list' }],
  },
  {
    labelKey: 'layout.nav.users',
    route: '/users',
    icon: '◉',
    roles: ['SuperAdmin'],
    children: [{ labelKey: 'layout.nav.usersList', route: '/users/list' }],
  },
];

/**
 * Role- and permission-aware visibility: keeps entries passing both the
 * role rule (no allow-list, or at least one listed role held) and the
 * permission rule (no allow-list, or `SuperAdmin` bypass, or at least one
 * listed permission held). Children inherit the outcome — a hidden group
 * hides its whole subsection, while a visible group still filters its own
 * children (e.g. `inventory.read` shows the group but hides `adjustments`
 * without `inventory.manage`).
 */
export function visibleDestinations(
  items: readonly AdminDestination[],
  roles: readonly string[],
  permissions: readonly string[] = [],
): readonly AdminDestination[] {
  const bypass = roles.includes('SuperAdmin');
  return items.flatMap((item) => {
    if (item.roles !== undefined && !item.roles.some((role) => roles.includes(role))) {
      return [];
    }
    if (
      !bypass &&
      item.permissions !== undefined &&
      !item.permissions.some((permission) => permissions.includes(permission))
    ) {
      return [];
    }
    const children =
      item.children === undefined
        ? undefined
        : visibleDestinations(item.children, roles, permissions);
    return [{ ...item, children }];
  });
}
