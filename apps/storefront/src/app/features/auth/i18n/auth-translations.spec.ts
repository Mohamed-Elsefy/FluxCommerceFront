import { describe, expect, it } from 'vitest';
import { AUTH_TRANSLATION_KEYS, translateAuthKey } from './auth-translations';

describe('translateAuthKey', () => {
  it('resolves page copy per culture', () => {
    expect(translateAuthKey('en', AUTH_TRANSLATION_KEYS.loginTitle)).toBe('Sign in');
    expect(translateAuthKey('fr', AUTH_TRANSLATION_KEYS.loginTitle)).toBe('Se connecter');
    expect(translateAuthKey('de', AUTH_TRANSLATION_KEYS.registerSubmit)).toBe('Konto erstellen');
    expect(translateAuthKey('es', AUTH_TRANSLATION_KEYS.forgotSubmit)).toBe('Enviar instrucciones');
    expect(translateAuthKey('ar', AUTH_TRANSLATION_KEYS.resetSubmit)).toBe('تحديث');
  });

  it('interpolates the email slot', () => {
    expect(
      translateAuthKey('en', AUTH_TRANSLATION_KEYS.registerDoneVerified, {
        email: 'ada@flux.local',
      }),
    ).toBe('Your account for ada@flux.local is ready. You can now sign in.');
    expect(
      translateAuthKey('ar', AUTH_TRANSLATION_KEYS.verifyDoneMessage, {
        email: 'ada@flux.local',
      }),
    ).toBe('شكراً — تم تأكيد ada@flux.local. يمكنك تسجيل الدخول.');
  });

  it('falls back deterministically for unknown cultures and keys', () => {
    expect(translateAuthKey('xx' as never, AUTH_TRANSLATION_KEYS.loginTitle)).toBe('Sign in');
    expect(translateAuthKey('en', 'auth.missing.key')).toBe('auth.missing.key');
  });
});
