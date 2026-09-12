/**
 * Unit tests for the catalog translation bundle (Sub-Phases 5.2–5.3).
 *
 * Covers key parity across all five cultures (every key resolves to a
 * non-empty, non-fallback string), deterministic `en` fallback for unknown
 * cultures, and graceful key-path passthrough for unknown keys — the
 * Phase 4 engine guarantees the UI never crashes on missing copy.
 */

import { describe, expect, it } from 'vitest';
import { lookupTranslationKey } from '@flux/i18n';
import {
  CATALOG_TRANSLATION_KEYS,
  CATALOG_TRANSLATION_RESOURCES,
  translateCatalogKey,
} from './catalog-translations';

const CULTURES = ['en', 'fr', 'de', 'es', 'ar'] as const;
const KEYS = Object.values(CATALOG_TRANSLATION_KEYS);

describe('catalog translation parity', () => {
  it('exposes a bundle for every supported culture', () => {
    expect(Object.keys(CATALOG_TRANSLATION_RESOURCES).sort()).toEqual([...CULTURES].sort());
  });

  it('resolves every owned key to a non-empty string in every culture', () => {
    for (const culture of CULTURES) {
      for (const key of KEYS) {
        const hit = lookupTranslationKey(CATALOG_TRANSLATION_RESOURCES[culture], key);
        expect(hit, `${culture}:${key}`).toBeTypeOf('string');
        expect(hit?.length, `${culture}:${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('interpolates params into slot templates', () => {
    expect(
      translateCatalogKey('en', CATALOG_TRANSLATION_KEYS.listingResultCount, { count: 3 }),
    ).toBe('3 products');
    expect(
      translateCatalogKey('fr', CATALOG_TRANSLATION_KEYS.listingResultCount, { count: 3 }),
    ).toBe('3 produits');
  });
  it('localizes copy (non-English cultures differ from English)', () => {
    for (const culture of ['fr', 'de', 'es', 'ar'] as const) {
      expect(translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesTitle)).not.toBe(
        translateCatalogKey('en', CATALOG_TRANSLATION_KEYS.categoriesTitle),
      );
    }
  });
});

describe('translateCatalogKey fallback', () => {
  it('falls back to English for unknown cultures', () => {
    expect(translateCatalogKey('xx' as never, CATALOG_TRANSLATION_KEYS.categoriesEmptyTitle)).toBe(
      translateCatalogKey('en', CATALOG_TRANSLATION_KEYS.categoriesEmptyTitle),
    );
  });

  it('returns the key path itself for unknown keys', () => {
    expect(translateCatalogKey('fr', 'catalog.categories.missing')).toBe(
      'catalog.categories.missing',
    );
  });
});
