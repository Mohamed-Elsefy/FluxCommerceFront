import { describe, expect, it } from 'vitest';
import { HOME_TRANSLATION_KEYS, translateHomeKey } from './home-translations';

describe('translateHomeKey', () => {
  it('resolves home copy per culture', () => {
    expect(translateHomeKey('en', HOME_TRANSLATION_KEYS.title)).toBe('Admin');
    expect(translateHomeKey('ar', HOME_TRANSLATION_KEYS.title)).toBe('الإدارة');
    expect(translateHomeKey('fr', HOME_TRANSLATION_KEYS.subtitle)).toContain('Coquille');
  });

  it('falls back deterministically for unknown cultures and keys', () => {
    expect(translateHomeKey('xx' as never, HOME_TRANSLATION_KEYS.title)).toBe('Admin');
    expect(translateHomeKey('en', 'home.missing.key')).toBe('home.missing.key');
  });
});
