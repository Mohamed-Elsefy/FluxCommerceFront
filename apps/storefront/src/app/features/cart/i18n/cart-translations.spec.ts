/**
 * Unit tests for the cart translation bundle (Sub-Phase 7.4).
 *
 * Covers key parity across all five cultures (every key resolves to a
 * non-empty, non-fallback string), deterministic `en` fallback for unknown
 * cultures, and graceful key-path passthrough for unknown keys — the
 * Phase 4 engine guarantees the UI never crashes on missing copy.
 */

import { describe, expect, it } from 'vitest';
import { lookupTranslationKey } from '@flux/i18n';
import {
  CART_TRANSLATION_KEYS,
  CART_TRANSLATION_RESOURCES,
  translateCartKey,
} from './cart-translations';

const CULTURES = ['en', 'fr', 'de', 'es', 'ar'] as const;
const KEYS = Object.values(CART_TRANSLATION_KEYS);

describe('cart translation parity', () => {
  it('exposes a bundle for every supported culture', () => {
    expect(Object.keys(CART_TRANSLATION_RESOURCES).sort()).toEqual([...CULTURES].sort());
  });

  it('resolves every owned key to a non-empty string in every culture', () => {
    for (const culture of CULTURES) {
      for (const key of KEYS) {
        const hit = lookupTranslationKey(CART_TRANSLATION_RESOURCES[culture], key);
        expect(hit, `${culture}:${key}`).toBeTypeOf('string');
        expect(hit?.length, `${culture}:${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('interpolates params into slot templates', () => {
    expect(translateCartKey('en', CART_TRANSLATION_KEYS.itemRemove, { product: 'Tee' })).toBe(
      'Remove Tee',
    );
    expect(translateCartKey('de', CART_TRANSLATION_KEYS.itemRemove, { product: 'Tee' })).toBe(
      'Tee entfernen',
    );
  });

  it('localizes copy (non-English cultures differ from English)', () => {
    for (const culture of ['fr', 'de', 'es', 'ar'] as const) {
      expect(translateCartKey(culture, CART_TRANSLATION_KEYS.pageTitle)).not.toBe(
        translateCartKey('en', CART_TRANSLATION_KEYS.pageTitle),
      );
    }
  });
});

describe('translateCartKey fallback', () => {
  it('falls back to English for unknown cultures', () => {
    expect(translateCartKey('xx' as never, CART_TRANSLATION_KEYS.pageEmptyTitle)).toBe(
      translateCartKey('en', CART_TRANSLATION_KEYS.pageEmptyTitle),
    );
  });

  it('returns the key path itself for unknown keys', () => {
    expect(translateCartKey('fr', 'cart.page.missing')).toBe('cart.page.missing');
  });
});
