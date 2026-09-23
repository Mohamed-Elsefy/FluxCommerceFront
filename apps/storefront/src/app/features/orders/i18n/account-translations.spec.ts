/**
 * Unit tests for the account translation bundle (Sub-Phase 10.2).
 *
 * Covers key parity across all five cultures (every key resolves to a
 * non-empty, non-fallback string), deterministic `en` fallback for
 * unknown cultures, `{email}` interpolation, and graceful key-path
 * passthrough for unknown keys — the Phase 4 engine guarantees the UI
 * never crashes on missing copy.
 */

import { describe, expect, it } from 'vitest';
import { lookupTranslationKey } from '@flux/i18n';
import {
  ACCOUNT_TRANSLATION_KEYS,
  ACCOUNT_TRANSLATION_RESOURCES,
  translateAccountKey,
} from './account-translations';

const CULTURES = ['en', 'fr', 'de', 'es', 'ar'] as const;
const KEYS = Object.values(ACCOUNT_TRANSLATION_KEYS);

describe('account translation parity', () => {
  it('exposes a bundle for every supported culture', () => {
    expect(Object.keys(ACCOUNT_TRANSLATION_RESOURCES).sort()).toEqual([...CULTURES].sort());
  });

  it('resolves every owned key to a non-empty string in every culture', () => {
    for (const culture of CULTURES) {
      for (const key of KEYS) {
        const hit = lookupTranslationKey(ACCOUNT_TRANSLATION_RESOURCES[culture], key);
        expect(hit, `${culture}:${key}`).toBeTypeOf('string');
        expect(hit?.length, `${culture}:${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('interpolates the signed-in email into slot templates', () => {
    expect(
      translateAccountKey('en', ACCOUNT_TRANSLATION_KEYS.shellSignedInAs, {
        email: 'ada@flux.local',
      }),
    ).toBe('Signed in as ada@flux.local');
    expect(
      translateAccountKey('ar', ACCOUNT_TRANSLATION_KEYS.shellSignedInAs, {
        email: 'ada@flux.local',
      }),
    ).toBe('تم تسجيل الدخول باسم ada@flux.local');
  });

  it('localizes copy (non-English cultures differ from English)', () => {
    for (const culture of ['fr', 'de', 'es', 'ar'] as const) {
      expect(translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.shellTitle)).not.toBe(
        translateAccountKey('en', ACCOUNT_TRANSLATION_KEYS.shellTitle),
      );
    }
  });
});

describe('translateAccountKey fallback', () => {
  it('falls back to English for unknown cultures', () => {
    expect(translateAccountKey('xx' as never, ACCOUNT_TRANSLATION_KEYS.navOrders)).toBe(
      translateAccountKey('en', ACCOUNT_TRANSLATION_KEYS.navOrders),
    );
  });

  it('returns the key path itself for unknown keys', () => {
    expect(translateAccountKey('fr', 'account.profile.missing')).toBe('account.profile.missing');
  });
});
