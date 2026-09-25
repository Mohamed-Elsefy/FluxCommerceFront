import { describe, expect, it } from 'vitest';
import { LAYOUT_TRANSLATION_KEYS, translateLayoutKey } from './layout-translations';

describe('translateLayoutKey', () => {
  it('resolves shell chrome per culture', () => {
    expect(translateLayoutKey('en', LAYOUT_TRANSLATION_KEYS.navCart)).toBe('Cart');
    expect(translateLayoutKey('fr', LAYOUT_TRANSLATION_KEYS.navCart)).toBe('Panier');
    expect(translateLayoutKey('de', LAYOUT_TRANSLATION_KEYS.navCatalog)).toBe('Katalog');
    expect(translateLayoutKey('es', LAYOUT_TRANSLATION_KEYS.navHome)).toBe('Inicio');
    expect(translateLayoutKey('ar', LAYOUT_TRANSLATION_KEYS.switchLabel)).toBe('اللغة');
  });

  it('interpolates the legal year', () => {
    expect(translateLayoutKey('en', LAYOUT_TRANSLATION_KEYS.legal, { year: 2026 })).toBe(
      '© 2026 FluxCommerce. All rights reserved.',
    );
    expect(translateLayoutKey('ar', LAYOUT_TRANSLATION_KEYS.legal, { year: 2026 })).toBe(
      '© 2026 FluxCommerce. جميع الحقوق محفوظة.',
    );
  });

  it('falls back deterministically for unknown cultures and keys', () => {
    expect(translateLayoutKey('xx' as never, LAYOUT_TRANSLATION_KEYS.navHome)).toBe('Home');
    expect(translateLayoutKey('en', 'layout.missing.key')).toBe('layout.missing.key');
  });
});
