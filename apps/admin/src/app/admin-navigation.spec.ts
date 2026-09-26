import { describe, expect, it } from 'vitest';
import { ADMIN_NAV_ITEMS, visibleDestinations } from './admin-navigation';

describe('admin navigation', () => {
  it('lists only existing portal routes with layout label keys', () => {
    expect(ADMIN_NAV_ITEMS.map((item) => item.route)).toEqual(['/', '/dashboard']);
    for (const item of ADMIN_NAV_ITEMS) {
      expect(item.labelKey.startsWith('layout.nav.')).toBe(true);
    }
  });

  it('shows unrestricted entries to every portal role', () => {
    expect(visibleDestinations(ADMIN_NAV_ITEMS, ['Admin'])).toHaveLength(2);
    expect(visibleDestinations(ADMIN_NAV_ITEMS, ['SuperAdmin'])).toHaveLength(2);
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
    ]);
    expect(visibleDestinations(items, ['SuperAdmin'])).toHaveLength(3);
    expect(visibleDestinations(items, [])).toHaveLength(2);
  });
});
