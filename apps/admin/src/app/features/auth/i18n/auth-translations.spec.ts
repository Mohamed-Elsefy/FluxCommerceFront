import { describe, expect, it } from 'vitest';
import { ADMIN_AUTH_TRANSLATION_KEYS, translateAdminAuthKey } from './auth-translations';

describe('translateAdminAuthKey', () => {
  it('resolves login copy per culture', () => {
    expect(translateAdminAuthKey('en', ADMIN_AUTH_TRANSLATION_KEYS.loginTitle)).toBe(
      'Admin sign in',
    );
    expect(translateAdminAuthKey('fr', ADMIN_AUTH_TRANSLATION_KEYS.loginTitle)).toBe(
      'Connexion admin',
    );
    expect(translateAdminAuthKey('de', ADMIN_AUTH_TRANSLATION_KEYS.loginSubmit)).toBe('Anmelden');
    expect(translateAdminAuthKey('es', ADMIN_AUTH_TRANSLATION_KEYS.loginEmailError)).toBe(
      'Introduzca un correo válido.',
    );
    expect(translateAdminAuthKey('ar', ADMIN_AUTH_TRANSLATION_KEYS.loginSubmitting)).toBe(
      'جارٍ تسجيل الدخول…',
    );
  });

  it('resolves keyway chrome copy per culture', () => {
    expect(translateAdminAuthKey('en', ADMIN_AUTH_TRANSLATION_KEYS.loginKicker)).toBe(
      '01 // Secure access',
    );
    expect(translateAdminAuthKey('en', ADMIN_AUTH_TRANSLATION_KEYS.loginBadge)).toBe('Admin');
    expect(translateAdminAuthKey('ar', ADMIN_AUTH_TRANSLATION_KEYS.loginBadge)).toBe('إدارة');
    expect(translateAdminAuthKey('fr', ADMIN_AUTH_TRANSLATION_KEYS.loginPasswordShow)).toBe(
      'Afficher le mot de passe',
    );
    expect(translateAdminAuthKey('de', ADMIN_AUTH_TRANSLATION_KEYS.loginSecurityNote)).toContain(
      'Sitzungen',
    );
  });

  it('falls back deterministically for unknown cultures and keys', () => {
    expect(translateAdminAuthKey('xx' as never, ADMIN_AUTH_TRANSLATION_KEYS.loginTitle)).toBe(
      'Admin sign in',
    );
    expect(translateAdminAuthKey('en', 'auth.missing.key')).toBe('auth.missing.key');
  });
});
