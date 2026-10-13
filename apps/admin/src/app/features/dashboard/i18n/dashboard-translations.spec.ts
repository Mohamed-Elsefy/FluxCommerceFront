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
    expect(translateDashboardKey('en', DASHBOARD_TRANSLATION_KEYS.catalogTotal, { count: 4 })).toBe(
      '4 products',
    );
  });

  it('resolves the recent-widgets, series, and net copy per culture', () => {
    expect(translateDashboardKey('en', DASHBOARD_TRANSLATION_KEYS.recentPaymentsTitle)).toBe(
      'Recent payments',
    );
    expect(translateDashboardKey('fr', DASHBOARD_TRANSLATION_KEYS.recentUsersTitle)).toBe(
      'Utilisateurs récents',
    );
    expect(translateDashboardKey('ar', DASHBOARD_TRANSLATION_KEYS.seriesTitle)).toBe(
      'الطلبات والإيرادات (آخر 30 يومًا)',
    );
    expect(translateDashboardKey('de', DASHBOARD_TRANSLATION_KEYS.seriesEmpty)).toBe(
      'Keine Aktivität in diesem Zeitraum.',
    );
    expect(translateDashboardKey('es', DASHBOARD_TRANSLATION_KEYS.paymentsNet)).toBe('Neto');
    expect(translateDashboardKey('en', DASHBOARD_TRANSLATION_KEYS.seriesOrdersLabel)).toBe(
      'Orders',
    );
    expect(translateDashboardKey('fr', DASHBOARD_TRANSLATION_KEYS.seriesRevenueLabel)).toBe(
      'Revenus',
    );
    expect(translateDashboardKey('ar', DASHBOARD_TRANSLATION_KEYS.seriesOrdersLabel)).toBe(
      'الطلبات',
    );
  });

  it('resolves the catalog card and empty-state copy per culture', () => {
    expect(translateDashboardKey('en', DASHBOARD_TRANSLATION_KEYS.catalogTitle)).toBe('Catalog');
    expect(translateDashboardKey('fr', DASHBOARD_TRANSLATION_KEYS.catalogTitle)).toBe('Catalogue');
    expect(translateDashboardKey('de', DASHBOARD_TRANSLATION_KEYS.catalogTitle)).toBe('Katalog');
    expect(translateDashboardKey('es', DASHBOARD_TRANSLATION_KEYS.catalogTitle)).toBe('Catálogo');
    expect(translateDashboardKey('ar', DASHBOARD_TRANSLATION_KEYS.catalogTitle)).toBe('الكتالوج');
    expect(translateDashboardKey('en', DASHBOARD_TRANSLATION_KEYS.emptyTitle)).toBe(
      'No sections available',
    );
    expect(translateDashboardKey('ar', DASHBOARD_TRANSLATION_KEYS.emptyTitle)).toBe(
      'لا توجد أقسام متاحة',
    );
    expect(translateDashboardKey('ar', DASHBOARD_TRANSLATION_KEYS.emptyMessage)).not.toBe(
      DASHBOARD_TRANSLATION_KEYS.emptyMessage,
    );
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
