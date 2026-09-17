/**
 * Unit tests for the checkout translation bundle (Sub-Phase 8.4).
 *
 * Covers key parity across all five cultures (every key resolves to a
 * non-empty, non-fallback string), deterministic `en` fallback for
 * unknown cultures, and graceful key-path passthrough for unknown keys
 * — the Phase 4 engine guarantees the UI never crashes on missing copy.
 */

import { describe, expect, it } from 'vitest';
import { lookupTranslationKey } from '@flux/i18n';
import {
  CHECKOUT_TRANSLATION_KEYS,
  CHECKOUT_TRANSLATION_RESOURCES,
  translateCheckoutKey,
} from './checkout-translations';

const CULTURES = ['en', 'fr', 'de', 'es', 'ar'] as const;
const KEYS = Object.values(CHECKOUT_TRANSLATION_KEYS);

describe('checkout translation parity', () => {
  it('exposes a bundle for every supported culture', () => {
    expect(Object.keys(CHECKOUT_TRANSLATION_RESOURCES).sort()).toEqual([...CULTURES].sort());
  });

  it('resolves every owned key to a non-empty string in every culture', () => {
    for (const culture of CULTURES) {
      for (const key of KEYS) {
        const hit = lookupTranslationKey(CHECKOUT_TRANSLATION_RESOURCES[culture], key);
        expect(hit, `${culture}:${key}`).toBeTypeOf('string');
        expect(hit?.length, `${culture}:${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('interpolates params into slot templates', () => {
    expect(
      translateCheckoutKey('en', CHECKOUT_TRANSLATION_KEYS.validationRequired, {
        label: 'City',
      }),
    ).toBe('City is required.');
    expect(
      translateCheckoutKey('en', CHECKOUT_TRANSLATION_KEYS.validationTooLong, {
        label: 'City',
        max: 100,
      }),
    ).toBe('City must be no more than 100 characters.');
    expect(
      translateCheckoutKey('de', CHECKOUT_TRANSLATION_KEYS.validationRequired, {
        label: 'Stadt',
      }),
    ).toBe('Stadt ist erforderlich.');
  });

  it('localizes copy (non-English cultures differ from English)', () => {
    for (const culture of ['fr', 'de', 'es', 'ar'] as const) {
      expect(translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.sectionsShipping)).not.toBe(
        translateCheckoutKey('en', CHECKOUT_TRANSLATION_KEYS.sectionsShipping),
      );
    }
  });
});

describe('translateCheckoutKey fallback', () => {
  it('falls back to English for unknown cultures', () => {
    expect(translateCheckoutKey('xx' as never, CHECKOUT_TRANSLATION_KEYS.submit)).toBe(
      translateCheckoutKey('en', CHECKOUT_TRANSLATION_KEYS.submit),
    );
  });

  it('returns the key path itself for unknown keys', () => {
    expect(translateCheckoutKey('fr', 'checkout.page.missing')).toBe('checkout.page.missing');
  });
});
