import { describe, expect, it } from 'vitest';
import {
  ADMIN_LAYOUT_TRANSLATION_RESOURCES,
  translateAdminLayoutKey,
} from './layout/layout-translations/layout-translations';
import { ADMIN_NAV_ITEMS, visibleDestinations, type AdminDestination } from './admin-navigation';

describe('admin navigation', () => {
  it('lists only existing portal routes with layout label keys', () => {
    expect(ADMIN_NAV_ITEMS.map((item) => item.route)).toEqual([
      '/dashboard',
      '/catalog',
      '/inventory',
      '/orders',
      '/payments',
      '/users',
    ]);
    for (const item of ADMIN_NAV_ITEMS) {
      expect(item.labelKey.startsWith('layout.nav.')).toBe(true);
    }
    const catalog = ADMIN_NAV_ITEMS.find((item) => item.route === '/catalog');
    expect(catalog?.children?.map((child) => child.route)).toEqual([
      '/catalog/products',
      '/catalog/categories',
    ]);
    expect(catalog?.children?.map((child) => child.labelKey)).toEqual([
      'layout.nav.products',
      'layout.nav.categories',
    ]);
    const inventory = ADMIN_NAV_ITEMS.find((item) => item.route === '/inventory');
    expect(inventory?.labelKey).toBe('layout.nav.inventory');
    expect(inventory?.children?.map((child) => child.route)).toEqual([
      '/inventory/stock',
      '/inventory/reservations',
      '/inventory/adjustments',
      '/inventory/new',
    ]);
    expect(inventory?.children?.map((child) => child.labelKey)).toEqual([
      'layout.nav.stock',
      'layout.nav.reservations',
      'layout.nav.adjustments',
      'layout.nav.newItem',
    ]);
    const orders = ADMIN_NAV_ITEMS.find((item) => item.route === '/orders');
    expect(orders?.labelKey).toBe('layout.nav.orders');
    expect(orders?.children?.map((child) => child.route)).toEqual(['/orders/list']);
    expect(orders?.children?.map((child) => child.labelKey)).toEqual(['layout.nav.ordersList']);
    const payments = ADMIN_NAV_ITEMS.find((item) => item.route === '/payments');
    expect(payments?.labelKey).toBe('layout.nav.payments');
    expect(payments?.children?.map((child) => child.route)).toEqual(['/payments/list']);
    expect(payments?.children?.map((child) => child.labelKey)).toEqual(['layout.nav.paymentsList']);
    const users = ADMIN_NAV_ITEMS.find((item) => item.route === '/users');
    expect(users?.labelKey).toBe('layout.nav.users');
    expect(users?.children?.map((child) => child.route)).toEqual(['/users/list']);
    expect(users?.children?.map((child) => child.labelKey)).toEqual(['layout.nav.usersList']);
  });

  it('shows every entry to fully permissioned roles (users needs users.read)', () => {
    const full = ['catalog.manage', 'inventory.read', 'orders.read', 'payments.read'];
    expect(visibleDestinations(ADMIN_NAV_ITEMS, ['Admin'], full)).toHaveLength(5);
    expect(visibleDestinations(ADMIN_NAV_ITEMS, ['Admin'], [...full, 'users.read'])).toHaveLength(
      6,
    );
    expect(visibleDestinations(ADMIN_NAV_ITEMS, ['SuperAdmin'], full)).toHaveLength(6);
  });

  it('shows the users entry on users.read only', () => {
    expect(
      visibleDestinations(ADMIN_NAV_ITEMS, ['Admin'], ['users.read']).map((item) => item.labelKey),
    ).toContain('layout.nav.users');
    expect(
      visibleDestinations(ADMIN_NAV_ITEMS, ['Admin'], ['orders.read']).map((item) => item.labelKey),
    ).not.toContain('layout.nav.users');
  });

  it('keeps the dashboard visible without any permission (adaptive landing)', () => {
    const visible = visibleDestinations(ADMIN_NAV_ITEMS, ['Admin'], []);

    expect(visible.map((item) => item.labelKey)).toEqual(['layout.nav.dashboard']);
  });

  it('shows entries matching held permissions (children inherit the group outcome)', () => {
    const visible = visibleDestinations(ADMIN_NAV_ITEMS, ['Admin'], ['inventory.read']);

    expect(visible.map((item) => item.labelKey)).toEqual([
      'layout.nav.dashboard',
      'layout.nav.inventory',
    ]);
    const inventory = visible.find((item) => item.route === '/inventory');
    // Stock/reservations inherit the group grant; adjustments and item
    // creation need manage.
    expect(inventory?.children?.map((child) => child.labelKey)).toEqual([
      'layout.nav.stock',
      'layout.nav.reservations',
    ]);
  });

  it('bypasses every permission gate for SuperAdmin without held permissions', () => {
    expect(visibleDestinations(ADMIN_NAV_ITEMS, ['SuperAdmin'], [])).toHaveLength(6);
  });

  it('shows the item-creation entry only with the manage permission', () => {
    const withManage = visibleDestinations(
      ADMIN_NAV_ITEMS,
      ['Admin'],
      ['inventory.read', 'inventory.manage'],
    );
    const inventory = withManage.find((item) => item.route === '/inventory');
    expect(inventory?.children?.map((child) => child.labelKey)).toContain('layout.nav.newItem');
  });

  it('shows the payments entry on either payments permission (OR semantics)', () => {
    expect(
      visibleDestinations(ADMIN_NAV_ITEMS, ['Admin'], ['payments.stats']).map(
        (item) => item.labelKey,
      ),
    ).toContain('layout.nav.payments');
    expect(
      visibleDestinations(ADMIN_NAV_ITEMS, ['Admin'], ['payments.read']).map(
        (item) => item.labelKey,
      ),
    ).toContain('layout.nav.payments');
    expect(
      visibleDestinations(ADMIN_NAV_ITEMS, ['Admin'], ['orders.read']).map((item) => item.labelKey),
    ).not.toContain('layout.nav.payments');
  });

  it('keeps the users entry for SuperAdmin without held permissions (supremacy)', () => {
    const full = ['catalog.manage', 'inventory.read', 'orders.read', 'payments.read'];
    expect(
      visibleDestinations(ADMIN_NAV_ITEMS, ['Admin'], full).map((item) => item.labelKey),
    ).not.toContain('layout.nav.users');
    expect(
      visibleDestinations(ADMIN_NAV_ITEMS, ['SuperAdmin'], []).map((item) => item.labelKey),
    ).toContain('layout.nav.users');
  });

  it('resolves every destination label in every culture (no key-path leakage)', () => {
    const flatten = (items: readonly AdminDestination[]): readonly string[] =>
      items.flatMap((item) => [
        item.labelKey,
        ...(item.children === undefined ? [] : flatten(item.children)),
      ]);
    for (const labelKey of flatten(ADMIN_NAV_ITEMS)) {
      for (const culture of Object.keys(ADMIN_LAYOUT_TRANSLATION_RESOURCES) as Array<
        keyof typeof ADMIN_LAYOUT_TRANSLATION_RESOURCES
      >) {
        expect(translateAdminLayoutKey(culture, labelKey), `${culture}:${labelKey}`).not.toBe(
          labelKey,
        );
      }
    }
  });

  it('hides restricted entries and their subsections without a matching role', () => {
    const items = [
      ...ADMIN_NAV_ITEMS,
      {
        labelKey: 'layout.nav.settings',
        icon: '●',
        roles: ['SuperAdmin'],
        children: [{ labelKey: 'layout.nav.dashboard', route: '/dashboard' }],
      },
    ] as const;
    // Full menu grant: the roles dimension alone decides here.
    const full = ['catalog.manage', 'inventory.read', 'orders.read', 'payments.read'];

    expect(visibleDestinations(items, ['Admin'], full).map((item) => item.labelKey)).toEqual([
      'layout.nav.dashboard',
      'layout.nav.catalog',
      'layout.nav.inventory',
      'layout.nav.orders',
      'layout.nav.payments',
    ]);
    expect(visibleDestinations(items, ['SuperAdmin'], full)).toHaveLength(7);
    expect(visibleDestinations(items, [], full)).toHaveLength(5);
  });
});
