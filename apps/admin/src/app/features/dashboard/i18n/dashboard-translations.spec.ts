import { describe, expect, it } from 'vitest';
import type { Culture } from '@flux/i18n';
import {
  DASHBOARD_TRANSLATION_KEYS,
  DASHBOARD_TRANSLATION_RESOURCES,
  translateDashboardKey,
} from './dashboard-translations';

const CULTURES: Culture[] = ['en', 'fr', 'de', 'es', 'ar'];

describe('translateDashboardKey', () => {
  it('resolves dashboard copy per culture', () => {
    expect(translateDashboardKey('en', DASHBOARD_TRANSLATION_KEYS.title)).toBe('Dashboard');
    expect(translateDashboardKey('fr', DASHBOARD_TRANSLATION_KEYS.title)).toBe('Tableau de bord');
    expect(translateDashboardKey('de', DASHBOARD_TRANSLATION_KEYS.inventoryTitle)).toBe('Bestand');
    expect(translateDashboardKey('es', DASHBOARD_TRANSLATION_KEYS.ordersTitle)).toBe('Pedidos');
    expect(translateDashboardKey('ar', DASHBOARD_TRANSLATION_KEYS.recentTitle)).toBe(
      'أحدث الطلبات',
    );
  });

  it('resolves session and section copy without key leakage', () => {
    expect(translateDashboardKey('fr', DASHBOARD_TRANSLATION_KEYS.sessionHeading)).toBe(
      'Votre session',
    );
    expect(translateDashboardKey('en', DASHBOARD_TRANSLATION_KEYS.ordersLink)).toContain('orders');
  });

  it('covers every key in every culture (no fallback to the key path)', () => {
    const keys = Object.values(DASHBOARD_TRANSLATION_KEYS);
    for (const culture of CULTURES) {
      for (const key of keys) {
        expect(translateDashboardKey(culture, key)).not.toBe(key);
      }
    }
  });

  it('interpolates section totals', () => {
    expect(translateDashboardKey('en', DASHBOARD_TRANSLATION_KEYS.ordersTotal, { count: 7 })).toBe(
      '7 orders',
    );
    expect(
      translateDashboardKey('ar', DASHBOARD_TRANSLATION_KEYS.ordersTotal, { count: 7 }),
    ).toContain('7');
  });

  it('falls back deterministically for unknown cultures and keys', () => {
    expect(translateDashboardKey('xx' as never, DASHBOARD_TRANSLATION_KEYS.title)).toBe(
      'Dashboard',
    );
    expect(translateDashboardKey('en', 'dashboard.missing.key')).toBe('dashboard.missing.key');
  });

  it('bundles exactly the five supported cultures', () => {
    expect(Object.keys(DASHBOARD_TRANSLATION_RESOURCES).sort()).toEqual([...CULTURES].sort());
  });
});
