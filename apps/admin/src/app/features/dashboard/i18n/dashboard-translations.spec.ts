import { describe, expect, it } from 'vitest';
import { DASHBOARD_TRANSLATION_KEYS, translateDashboardKey } from './dashboard-translations';

describe('translateDashboardKey', () => {
  it('resolves dashboard copy per culture', () => {
    expect(translateDashboardKey('en', DASHBOARD_TRANSLATION_KEYS.title)).toBe('Dashboard');
    expect(translateDashboardKey('fr', DASHBOARD_TRANSLATION_KEYS.title)).toBe('Tableau de bord');
    expect(translateDashboardKey('de', DASHBOARD_TRANSLATION_KEYS.inventoryTitle)).toBe('Bestand');
    expect(translateDashboardKey('es', DASHBOARD_TRANSLATION_KEYS.ordersTitle)).toBe('Pedidos');
    expect(translateDashboardKey('ar', DASHBOARD_TRANSLATION_KEYS.upcomingBadge)).toBe('قريبًا');
  });

  it('resolves session and module copy without key leakage', () => {
    expect(translateDashboardKey('fr', DASHBOARD_TRANSLATION_KEYS.sessionHeading)).toBe(
      'Votre session',
    );
    expect(translateDashboardKey('en', DASHBOARD_TRANSLATION_KEYS.catalogDescription)).toContain(
      'Products',
    );
  });

  it('falls back deterministically for unknown cultures and keys', () => {
    expect(translateDashboardKey('xx' as never, DASHBOARD_TRANSLATION_KEYS.title)).toBe(
      'Dashboard',
    );
    expect(translateDashboardKey('en', 'dashboard.missing.key')).toBe('dashboard.missing.key');
  });
});
