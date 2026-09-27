import { describe, expect, it } from 'vitest';
import {
  ADMIN_LAYOUT_TRANSLATION_RESOURCES,
  translateAdminLayoutKey,
} from './layout/layout-translations/layout-translations';
import { ADMIN_NAV_ITEMS, visibleDestinations, type AdminDestination } from './admin-navigation';

describe('admin navigation', () => {
  it('lists only existing portal routes with layout label keys', () => {
    expect(ADMIN_NAV_ITEMS.map((item) => item.route)).toEqual([
      '/',
      '/dashboard',
      '/catalog',
      '/inventory',
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
    expect(inventory?.children).toBeUndefined();
  });

  it('shows unrestricted entries to every portal role', () => {
    expect(visibleDestinations(ADMIN_NAV_ITEMS, ['Admin'])).toHaveLength(4);
    expect(visibleDestinations(ADMIN_NAV_ITEMS, ['SuperAdmin'])).toHaveLength(4);
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
      'layout.nav.inventory',
    ]);
    expect(visibleDestinations(items, ['SuperAdmin'])).toHaveLength(5);
    expect(visibleDestinations(items, [])).toHaveLength(4);
  });
});
