/**
 * Unit tests for the product-details translation bundle (Sub-Phase 6.2).
 *
 * Covers key parity across all five cultures (every key resolves to a
 * non-empty, non-fallback string), deterministic `en` fallback for unknown
 * cultures, and graceful key-path passthrough for unknown keys — the
 * Phase 4 engine guarantees the UI never crashes on missing copy.
 */

import { describe, expect, it } from 'vitest';
import { lookupTranslationKey } from '@flux/i18n';
import {
  PRODUCT_DETAILS_TRANSLATION_KEYS,
  PRODUCT_DETAILS_TRANSLATION_RESOURCES,
  translateProductDetailsKey,
} from './product-details-translations';

const CULTURES = ['en', 'fr', 'de', 'es', 'ar'] as const;
const KEYS = Object.values(PRODUCT_DETAILS_TRANSLATION_KEYS);

describe('product-details translation parity', () => {
  it('exposes a bundle for every supported culture', () => {
    expect(Object.keys(PRODUCT_DETAILS_TRANSLATION_RESOURCES).sort()).toEqual([...CULTURES].sort());
  });

  it('resolves every owned key to a non-empty string in every culture', () => {
    for (const culture of CULTURES) {
      for (const key of KEYS) {
        const hit = lookupTranslationKey(PRODUCT_DETAILS_TRANSLATION_RESOURCES[culture], key);
        expect(hit, `${culture}:${key}`).toBeTypeOf('string');
        expect(hit?.length, `${culture}:${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('localizes copy (non-English cultures differ from English)', () => {
    for (const culture of ['fr', 'de', 'es', 'ar'] as const) {
      expect(
        translateProductDetailsKey(culture, PRODUCT_DETAILS_TRANSLATION_KEYS.pageTitle),
      ).not.toBe(translateProductDetailsKey('en', PRODUCT_DETAILS_TRANSLATION_KEYS.pageTitle));
    }
  });
});

describe('translateProductDetailsKey fallback', () => {
  it('falls back to English for unknown cultures', () => {
    expect(
      translateProductDetailsKey('xx' as never, PRODUCT_DETAILS_TRANSLATION_KEYS.notFoundTitle),
    ).toBe(translateProductDetailsKey('en', PRODUCT_DETAILS_TRANSLATION_KEYS.notFoundTitle));
  });

  it('returns the key path itself for unknown keys', () => {
    expect(translateProductDetailsKey('fr', 'productDetails.page.missing')).toBe(
      'productDetails.page.missing',
    );
  });
});
