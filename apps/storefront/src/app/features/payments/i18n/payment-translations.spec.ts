/**
 * Model tests for the Sub-Phase 9.10 `payment-translations` bundle
 * (Payment UI & Checkout Integration).
 *
 * Covers key parity across all five cultures (every key resolves to a
 * non-empty string), deterministic `en` fallback for unknown cultures,
 * `{orderId}` interpolation, and localization proof (non-English
 * cultures differ from English) — the Phase 4 engine guarantees the UI
 * never crashes on missing copy.
 */

import { describe, expect, it } from 'vitest';
import { lookupTranslationKey } from '@flux/i18n';
import {
  PAYMENT_TRANSLATION_KEYS,
  PAYMENT_TRANSLATION_RESOURCES,
  translatePaymentKey,
} from './payment-translations';

const CULTURES = ['en', 'fr', 'de', 'es', 'ar'] as const;
const KEYS = Object.values(PAYMENT_TRANSLATION_KEYS);

describe('payment translation parity', () => {
  it('exposes a bundle for every supported culture', () => {
    expect(Object.keys(PAYMENT_TRANSLATION_RESOURCES).sort()).toEqual([...CULTURES].sort());
  });

  it('resolves every owned key to a non-empty string in every culture', () => {
    for (const culture of CULTURES) {
      for (const key of KEYS) {
        const hit = lookupTranslationKey(PAYMENT_TRANSLATION_RESOURCES[culture], key);
        expect(hit, `${culture}:${key}`).toBeTypeOf('string');
        expect(hit?.length, `${culture}:${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('interpolates the order id into slot templates', () => {
    expect(
      translatePaymentKey('en', PAYMENT_TRANSLATION_KEYS.pageOrderLabel, { orderId: 'ORD-1' }),
    ).toBe('Order ORD-1');
    expect(
      translatePaymentKey('ar', PAYMENT_TRANSLATION_KEYS.pageOrderLabel, { orderId: 'ORD-1' }),
    ).toBe('الطلب ORD-1');
  });

  it('localizes copy (non-English cultures differ from English)', () => {
    for (const culture of ['fr', 'de', 'es', 'ar'] as const) {
      expect(translatePaymentKey(culture, PAYMENT_TRANSLATION_KEYS.formSubmit)).not.toBe(
        translatePaymentKey('en', PAYMENT_TRANSLATION_KEYS.formSubmit),
      );
    }
  });
});

describe('translatePaymentKey fallback', () => {
  it('falls back to English for unknown cultures', () => {
    expect(translatePaymentKey('xx' as never, PAYMENT_TRANSLATION_KEYS.formSubmit)).toBe(
      translatePaymentKey('en', PAYMENT_TRANSLATION_KEYS.formSubmit),
    );
  });

  it('passes unknown key paths through instead of crashing', () => {
    expect(translatePaymentKey('en', 'payment.nope.missing')).toBe('payment.nope.missing');
  });
});
