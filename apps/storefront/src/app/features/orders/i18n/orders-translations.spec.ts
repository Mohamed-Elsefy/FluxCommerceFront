/**
 * Unit tests for the orders list translation bundle (Sub-Phase 10.3).
 *
 * Covers key parity across all five cultures (every key resolves to a
 * non-empty string), deterministic `en` fallback for unknown cultures,
 * and graceful key-path passthrough for unknown keys.
 */

import { describe, expect, it } from 'vitest';
import { lookupTranslationKey } from '@flux/i18n';
import {
  ORDERS_TRANSLATION_KEYS,
  ORDERS_TRANSLATION_RESOURCES,
  translateOrdersKey,
} from './orders-translations';

const CULTURES = ['en', 'fr', 'de', 'es', 'ar'] as const;
const KEYS = Object.values(ORDERS_TRANSLATION_KEYS);

describe('orders translation parity', () => {
  it('exposes a bundle for every supported culture', () => {
    expect(Object.keys(ORDERS_TRANSLATION_RESOURCES).sort()).toEqual([...CULTURES].sort());
  });

  it('resolves every owned key to a non-empty string in every culture', () => {
    for (const culture of CULTURES) {
      for (const key of KEYS) {
        const hit = lookupTranslationKey(ORDERS_TRANSLATION_RESOURCES[culture], key);
        expect(hit, `${culture}:${key}`).toBeTypeOf('string');
        expect(hit?.length, `${culture}:${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('localizes copy (non-English cultures differ from English)', () => {
    for (const culture of ['fr', 'de', 'es', 'ar'] as const) {
      expect(translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listTitle)).not.toBe(
        translateOrdersKey('en', ORDERS_TRANSLATION_KEYS.listTitle),
      );
      expect(translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsTitle)).not.toBe(
        translateOrdersKey('en', ORDERS_TRANSLATION_KEYS.detailsTitle),
      );
    }
  });

  it('interpolates params into slot templates', () => {
    expect(
      translateOrdersKey('en', ORDERS_TRANSLATION_KEYS.detailsTitle, {
        orderNumber: 'ORD-ABC123DEF456',
      }),
    ).toBe('Order ORD-ABC123DEF456');
    expect(
      translateOrdersKey('de', ORDERS_TRANSLATION_KEYS.detailsTitle, {
        orderNumber: 'ORD-ABC123DEF456',
      }),
    ).toBe('Bestellung ORD-ABC123DEF456');
  });
});

describe('translateOrdersKey fallback', () => {
  it('falls back to English for unknown cultures', () => {
    expect(translateOrdersKey('xx' as never, ORDERS_TRANSLATION_KEYS.listTitle)).toBe(
      translateOrdersKey('en', ORDERS_TRANSLATION_KEYS.listTitle),
    );
  });

  it('returns the key path itself for unknown keys', () => {
    expect(translateOrdersKey('fr', 'orders.list.missing')).toBe('orders.list.missing');
  });
});
