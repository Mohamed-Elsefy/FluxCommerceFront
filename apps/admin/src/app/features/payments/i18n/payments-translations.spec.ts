import { describe, expect, it } from 'vitest';
import type { Culture } from '@flux/i18n';
import {
  PAYMENTS_TRANSLATION_KEYS,
  PAYMENTS_TRANSLATION_RESOURCES,
  translatePaymentsKey,
} from './payments-translations';

const CULTURES: Culture[] = ['en', 'fr', 'de', 'es', 'ar'];

describe('payments translations (S1.9 admin slice)', () => {
  it('resolves the list heading in every culture without key leakage', () => {
    for (const culture of CULTURES) {
      const heading = translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.listHeading);
      expect(heading).not.toBe(PAYMENTS_TRANSLATION_KEYS.listHeading);
      expect(heading.length).toBeGreaterThan(0);
    }
    expect(translatePaymentsKey('en', PAYMENTS_TRANSLATION_KEYS.listHeading)).toBe('Payments');
    expect(translatePaymentsKey('fr', PAYMENTS_TRANSLATION_KEYS.listHeading)).toBe('Paiements');
    expect(translatePaymentsKey('ar', PAYMENTS_TRANSLATION_KEYS.listHeading)).toBe('المدفوعات');
  });

  it('covers every key in every culture (no fallback to the key path)', () => {
    const keys = Object.values(PAYMENTS_TRANSLATION_KEYS);
    for (const culture of CULTURES) {
      for (const key of keys) {
        expect(translatePaymentsKey(culture, key)).not.toBe(key);
      }
    }
  });

  it('interpolates the summary total count', () => {
    expect(translatePaymentsKey('en', PAYMENTS_TRANSLATION_KEYS.summaryTotal, { count: 7 })).toBe(
      '7 payments',
    );
    expect(
      translatePaymentsKey('ar', PAYMENTS_TRANSLATION_KEYS.summaryTotal, { count: 7 }),
    ).toContain('7');
  });

  it('falls back to English for unknown cultures, then to the key path', () => {
    expect(translatePaymentsKey('xx' as never, PAYMENTS_TRANSLATION_KEYS.title)).toBe(
      translatePaymentsKey('en', PAYMENTS_TRANSLATION_KEYS.title),
    );
    expect(translatePaymentsKey('en', 'payments.missing.key')).toBe('payments.missing.key');
  });

  it('bundles exactly the five supported cultures', () => {
    expect(Object.keys(PAYMENTS_TRANSLATION_RESOURCES).sort()).toEqual([...CULTURES].sort());
  });
});
