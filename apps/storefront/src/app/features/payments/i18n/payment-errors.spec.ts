/**
 * Unit tests for the Sub-Phase 9.10 `resolvePaymentErrorMessage`
 * (Payment UI & Checkout Integration).
 *
 * Covers the resolution contract: decline text passthrough, feature
 * error-code mapping across cultures, base status fallback for unknown
 * codes, `null` input resolving to `null` (shells hide), and the
 * sensitive-data sweep (no identifiers, secrets, or technical internals
 * leak into user-facing copy).
 */

import { describe, expect, it } from 'vitest';
import { ApiError } from '@flux/api';
import { resolvePaymentErrorMessage } from './payment-errors';

const CULTURES = ['en', 'fr', 'de', 'es', 'ar'] as const;

describe('resolvePaymentErrorMessage', () => {
  it('returns null for nullish errors (shells hide)', () => {
    expect(resolvePaymentErrorMessage(null, 'en')).toBeNull();
    expect(resolvePaymentErrorMessage(undefined, 'ar')).toBeNull();
  });

  it('passes displayable decline text through verbatim', () => {
    const failure = new ApiError({
      status: 0,
      code: 'PaymentDeclined',
      message: 'Your card was declined.',
    });
    expect(resolvePaymentErrorMessage(failure, 'en')).toBe('Your card was declined.');
    expect(resolvePaymentErrorMessage(failure, 'fr')).toBe('Your card was declined.');
  });

  it('maps feature codes to localized copy in every culture', () => {
    const codes = [
      'PaymentContractBlocked',
      'ProviderSetupFailed',
      'Payment.Failed',
      'Payment.NotFound',
      'Payment.NotReady',
      'Payment.NotPayable',
      'Payment.ProviderUnavailable',
      'Payment.OrderIdRequired',
    ];
    for (const code of codes) {
      for (const culture of CULTURES) {
        const message = resolvePaymentErrorMessage(
          new ApiError({ status: 0, code, message: 'technical diagnostic' }),
          culture,
        );
        expect(message, `${culture}:${code}`).toBeTypeOf('string');
        expect(message?.length ?? 0, `${culture}:${code}`).toBeGreaterThan(0);
        expect(message, `${culture}:${code}`).not.toContain('technical diagnostic');
      }
    }
    expect(
      resolvePaymentErrorMessage(
        new ApiError({ status: 0, code: 'PaymentContractBlocked', message: 'x' }),
        'fr',
      ),
    ).not.toBe(
      resolvePaymentErrorMessage(
        new ApiError({ status: 0, code: 'PaymentContractBlocked', message: 'x' }),
        'en',
      ),
    );
  });

  it('falls back to the shared base resolver for unknown codes', () => {
    const failure = new ApiError({ status: 401, code: 'Something.Else', message: 'x' });
    expect(resolvePaymentErrorMessage(failure, 'en')).toBeTypeOf('string');
  });

  it('maps codeless 404s to the payment not-found copy (by-order wire reality)', () => {
    for (const culture of CULTURES) {
      const message = resolvePaymentErrorMessage(
        new ApiError({ status: 404, message: 'Payment not found.' }),
        culture,
      );
      expect(message, culture).toBeTypeOf('string');
      expect(message?.length ?? 0, culture).toBeGreaterThan(0);
    }
    // Localized per culture (feature copy, not the generic fallback):
    // every culture resolves, and non-English cultures differ from English.
    expect(resolvePaymentErrorMessage(new ApiError({ status: 404, message: 'x' }), 'fr')).not.toBe(
      resolvePaymentErrorMessage(new ApiError({ status: 404, message: 'x' }), 'en'),
    );
    expect(resolvePaymentErrorMessage(new ApiError({ status: 404, message: 'x' }), 'ar')).not.toBe(
      resolvePaymentErrorMessage(new ApiError({ status: 404, message: 'x' }), 'en'),
    );
  });

  it('leaks no identifiers, secrets, or technical internals', () => {
    const orderId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    const secret = 'pi_123_secret_abc';
    const failures = [
      new ApiError({
        status: 0,
        code: 'PaymentContractBlocked',
        message: `no request for ${orderId}`,
      }),
      new ApiError({ status: 0, code: 'ProviderSetupFailed', message: `secret ${secret} failed` }),
      new ApiError({ status: 404, code: 'Payment.NotFound', message: orderId }),
      new ApiError({ status: 404, message: `missing ${orderId}` }),
    ];
    for (const failure of failures) {
      for (const culture of CULTURES) {
        const message = resolvePaymentErrorMessage(failure, culture) ?? '';
        expect(message).not.toContain(orderId);
        expect(message).not.toContain(secret);
        expect(message).not.toMatch(/no request was sent|secret|pi_/i);
      }
    }
  });
});
