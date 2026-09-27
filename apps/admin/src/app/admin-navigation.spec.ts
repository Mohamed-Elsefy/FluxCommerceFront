import { describe, expect, it } from 'vitest';
import { ADMIN_NAV_ITEMS, visibleDestinations } from './admin-navigation';

describe('admin navigation', () => {
  it('lists only existing portal routes with layout label keys', () => {
    expect(ADMIN_NAV_ITEMS.map((item) => item.route)).toEqual(['/', '/dashboard', '/catalog']);
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
  });

  it('shows unrestricted entries to every portal role', () => {
    expect(visibleDestinations(ADMIN_NAV_ITEMS, ['Admin'])).toHaveLength(3);
    expect(visibleDestinations(ADMIN_NAV_ITEMS, ['SuperAdmin'])).toHaveLength(3);
  });

  it('hides restricted entries and their subsections without a matching role', () => {
    const items = [
      ...ADMIN_NAV_ITEMS,
      {
        labelKey: 'layout.nav.users',
        icon: '●',
        roles: ['SuperAdmin'],
        children: [{ labelKey: 'layout.nav.dashboard', route: '/dashboard' }],
      },
    ] as const;

    expect(visibleDestinations(items, ['Admin']).map((item) => item.labelKey)).toEqual([
      'layout.nav.home',
      'layout.nav.dashboard',
      'layout.nav.catalog',
    ]);
    expect(visibleDestinations(items, ['SuperAdmin'])).toHaveLength(4);
    expect(visibleDestinations(items, [])).toHaveLength(3);
  });
});
