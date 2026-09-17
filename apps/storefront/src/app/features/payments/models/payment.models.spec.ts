/**
 * Model tests for the Sub-Phase 9.2 `payment.models` (Payment Feature
 * Foundation).
 *
 * Covers the routing shapes only: the `:orderId` param contract, the
 * structural order-id guard, param-map reading (missing/blank ids stay
 * blocked, never fabricated), and the entry/result path builders. No API,
 * no state, no provider behavior is asserted here — those arrive in
 * Sub-Phases 9.3+.
 */

import { describe, expect, it } from 'vitest';
import { convertToParamMap } from '@angular/router';
import {
  PAYMENT_ORDER_ID_PARAM,
  PAYMENT_RESULT_PATH_SUFFIX,
  isValidPaymentOrderId,
  paymentPath,
  paymentResultPath,
  readPaymentRouteParams,
} from './payment.models';

const ORDER_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

describe('payment route param contract', () => {
  it('names the order id param and the result suffix', () => {
    expect(PAYMENT_ORDER_ID_PARAM).toBe('orderId');
    expect(PAYMENT_RESULT_PATH_SUFFIX).toBe('result');
  });

  it('accepts non-blank order ids', () => {
    expect(isValidPaymentOrderId(ORDER_ID)).toBe(true);
  });

  it('rejects missing, blank, or non-string order ids', () => {
    expect(isValidPaymentOrderId(null)).toBe(false);
    expect(isValidPaymentOrderId(undefined)).toBe(false);
    expect(isValidPaymentOrderId('')).toBe(false);
    expect(isValidPaymentOrderId('   ')).toBe(false);
    expect(isValidPaymentOrderId(42)).toBe(false);
  });
});

describe('readPaymentRouteParams', () => {
  it('reads the order id out of the param map', () => {
    expect(readPaymentRouteParams(convertToParamMap({ orderId: ORDER_ID }))).toEqual({
      orderId: ORDER_ID,
    });
  });

  it('returns null for a missing or blank order id', () => {
    expect(readPaymentRouteParams(convertToParamMap({}))).toBeNull();
    expect(readPaymentRouteParams(convertToParamMap({ orderId: '' }))).toBeNull();
    expect(readPaymentRouteParams(convertToParamMap({ orderId: '   ' }))).toBeNull();
  });

  it('returns null for a missing param map', () => {
    expect(readPaymentRouteParams(null)).toBeNull();
    expect(readPaymentRouteParams(undefined)).toBeNull();
  });
});

describe('payment path builders', () => {
  it('builds the payment entry path', () => {
    expect(paymentPath(ORDER_ID)).toBe(`/payment/${ORDER_ID}`);
  });

  it('builds the payment result path under the entry', () => {
    expect(paymentResultPath(ORDER_ID)).toBe(`/payment/${ORDER_ID}/result`);
  });
});
