/**
 * Unit tests for the Sub-Phase 5.9 home translation bundle.
 *
 * Covers key parity across all five cultures, deterministic `en` fallback,
 * and graceful key-path passthrough — mirroring the catalog bundle
 * contract so the discovery entry never renders missing copy.
 */

import { describe, expect, it } from 'vitest';
import { lookupTranslationKey } from '@flux/i18n';
import {
  HOME_TRANSLATION_KEYS,
  HOME_TRANSLATION_RESOURCES,
  translateHomeKey,
} from './home-translations';

const CULTURES = ['en', 'fr', 'de', 'es', 'ar'] as const;
const KEYS = Object.values(HOME_TRANSLATION_KEYS);

describe('home translation parity', () => {
  it('exposes a bundle for every supported culture', () => {
    expect(Object.keys(HOME_TRANSLATION_RESOURCES).sort()).toEqual([...CULTURES].sort());
  });

  it('resolves every owned key to a non-empty string in every culture', () => {
    for (const culture of CULTURES) {
      for (const key of KEYS) {
        const hit = lookupTranslationKey(HOME_TRANSLATION_RESOURCES[culture], key);
        expect(hit, `${culture}:${key}`).toBeTypeOf('string');
        expect(hit?.length, `${culture}:${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('localizes copy (non-English cultures differ from English)', () => {
    for (const culture of ['fr', 'de', 'es', 'ar'] as const) {
      expect(translateHomeKey(culture, HOME_TRANSLATION_KEYS.discoveryTitle)).not.toBe(
        translateHomeKey('en', HOME_TRANSLATION_KEYS.discoveryTitle),
      );
    }
  });
});

describe('translateHomeKey fallback', () => {
  it('falls back to English for unknown cultures', () => {
    expect(translateHomeKey('xx' as never, HOME_TRANSLATION_KEYS.discoveryLink)).toBe(
      translateHomeKey('en', HOME_TRANSLATION_KEYS.discoveryLink),
    );
  });

  it('returns the key path itself for unknown keys', () => {
    expect(translateHomeKey('fr', 'home.discovery.missing')).toBe('home.discovery.missing');
  });
});
