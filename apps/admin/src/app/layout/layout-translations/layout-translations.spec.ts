import { describe, expect, it } from 'vitest';
import { ADMIN_LAYOUT_TRANSLATION_KEYS, translateAdminLayoutKey } from './layout-translations';

describe('translateAdminLayoutKey', () => {
  it('resolves shell chrome per culture', () => {
    expect(translateAdminLayoutKey('en', ADMIN_LAYOUT_TRANSLATION_KEYS.navDashboard)).toBe(
      'Dashboard',
    );
    expect(translateAdminLayoutKey('fr', ADMIN_LAYOUT_TRANSLATION_KEYS.navDashboard)).toBe(
      'Tableau de bord',
    );
    expect(translateAdminLayoutKey('de', ADMIN_LAYOUT_TRANSLATION_KEYS.navHome)).toBe('Startseite');
    expect(translateAdminLayoutKey('es', ADMIN_LAYOUT_TRANSLATION_KEYS.navHome)).toBe('Inicio');
    expect(translateAdminLayoutKey('ar', ADMIN_LAYOUT_TRANSLATION_KEYS.switchLabel)).toBe('اللغة');
    expect(translateAdminLayoutKey('en', ADMIN_LAYOUT_TRANSLATION_KEYS.navOrders)).toBe('Orders');
    expect(translateAdminLayoutKey('fr', ADMIN_LAYOUT_TRANSLATION_KEYS.navOrders)).toBe(
      'Commandes',
    );
    expect(translateAdminLayoutKey('de', ADMIN_LAYOUT_TRANSLATION_KEYS.navOrdersList)).toBe(
      'Bestellliste',
    );
  });

  it('resolves header, skip-link, and account copy without key leakage', () => {
    expect(translateAdminLayoutKey('fr', ADMIN_LAYOUT_TRANSLATION_KEYS.headerMenuLabel)).toBe(
      'Basculer la navigation',
    );
    expect(translateAdminLayoutKey('ar', ADMIN_LAYOUT_TRANSLATION_KEYS.skipLink)).toBe(
      'تخطَّ إلى المحتوى الرئيسي',
    );
    expect(translateAdminLayoutKey('de', ADMIN_LAYOUT_TRANSLATION_KEYS.authLogout)).toBe(
      'Abmelden',
    );
  });

  it('resolves denial and not-found pages per culture', () => {
    expect(translateAdminLayoutKey('en', ADMIN_LAYOUT_TRANSLATION_KEYS.forbiddenTitle)).toBe(
      'Access denied',
    );
    expect(translateAdminLayoutKey('de', ADMIN_LAYOUT_TRANSLATION_KEYS.forbiddenTitle)).toBe(
      'Zugriff verweigert',
    );
    expect(translateAdminLayoutKey('es', ADMIN_LAYOUT_TRANSLATION_KEYS.notFoundTitle)).toBe(
      'Página no encontrada',
    );
    expect(translateAdminLayoutKey('ar', ADMIN_LAYOUT_TRANSLATION_KEYS.notFoundBack)).toBe(
      'عودة للرئيسية',
    );
    expect(translateAdminLayoutKey('fr', ADMIN_LAYOUT_TRANSLATION_KEYS.forbiddenMessage)).toBe(
      "Vous n'avez pas l'autorisation de voir cette page.",
    );
  });

  it('resolves drawer and notification chrome per culture', () => {
    expect(translateAdminLayoutKey('en', ADMIN_LAYOUT_TRANSLATION_KEYS.drawerCloseOverlay)).toBe(
      'Close navigation',
    );
    expect(translateAdminLayoutKey('ar', ADMIN_LAYOUT_TRANSLATION_KEYS.notificationsLabel)).toBe(
      'الإشعارات',
    );
    expect(translateAdminLayoutKey('de', ADMIN_LAYOUT_TRANSLATION_KEYS.notificationsDismiss)).toBe(
      'Schließen',
    );
  });

  it('falls back deterministically for unknown cultures and keys', () => {
    expect(translateAdminLayoutKey('xx' as never, ADMIN_LAYOUT_TRANSLATION_KEYS.navHome)).toBe(
      'Home',
    );
    expect(translateAdminLayoutKey('en', 'layout.missing.key')).toBe('layout.missing.key');
  });
});
