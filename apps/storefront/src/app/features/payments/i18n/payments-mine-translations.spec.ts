import { describe, expect, it } from 'vitest';
import type { Culture } from '@flux/i18n';
import {
  PAYMENTS_MINE_TRANSLATION_KEYS,
  PAYMENTS_MINE_TRANSLATION_RESOURCES,
  translatePaymentsMineKey,
} from './payments-mine-translations';

const CULTURES: Culture[] = ['en', 'fr', 'de', 'es', 'ar'];

describe('payments-mine translations (S1.9 storefront slice)', () => {
  it('resolves the title in every culture without key leakage', () => {
    for (const culture of CULTURES) {
      const title = translatePaymentsMineKey(culture, PAYMENTS_MINE_TRANSLATION_KEYS.title);
      expect(title).not.toBe(PAYMENTS_MINE_TRANSLATION_KEYS.title);
      expect(title.length).toBeGreaterThan(0);
    }
    expect(translatePaymentsMineKey('en', PAYMENTS_MINE_TRANSLATION_KEYS.title)).toBe(
      'My payments',
    );
    expect(translatePaymentsMineKey('fr', PAYMENTS_MINE_TRANSLATION_KEYS.title)).toBe(
      'Mes paiements',
    );
    expect(translatePaymentsMineKey('ar', PAYMENTS_MINE_TRANSLATION_KEYS.title)).toBe('مدفوعاتي');
  });

  it('covers every key in every culture (no fallback to the key path)', () => {
    const keys = Object.values(PAYMENTS_MINE_TRANSLATION_KEYS);
    for (const culture of CULTURES) {
      for (const key of keys) {
        expect(translatePaymentsMineKey(culture, key)).not.toBe(key);
      }
    }
  });

  it('falls back to English for unknown cultures, then to the key path', () => {
    expect(translatePaymentsMineKey('xx' as never, PAYMENTS_MINE_TRANSLATION_KEYS.title)).toBe(
      translatePaymentsMineKey('en', PAYMENTS_MINE_TRANSLATION_KEYS.title),
    );
    expect(translatePaymentsMineKey('en', 'paymentMine.missing.key')).toBe(
      'paymentMine.missing.key',
    );
  });

  it('bundles exactly the five supported cultures', () => {
    expect(Object.keys(PAYMENTS_MINE_TRANSLATION_RESOURCES).sort()).toEqual([...CULTURES].sort());
  });
});
