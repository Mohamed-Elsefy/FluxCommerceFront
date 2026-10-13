/**
 * Model tests for the Sub-Phase 9.2 `payment.models` (Payment Feature
 * Foundation) plus the Sub-Phase 9.9 recovery decision tables.
 *
 * Covers the routing shapes (param contract, guards, path builders)
 * and the pure 9.9 classifiers: failure-kind distinction
 * (initialization vs. confirmation) and the recovery action table
 * (retry-initialization vs. check-status vs. none). No API, no state,
 * no provider behavior is asserted here — execution lives in state and
 * pages.
 */

import { describe, expect, it } from 'vitest';
import { convertToParamMap } from '@angular/router';
import { ApiError } from '@flux/api';
import {
  INIT_POLL_INTERVAL_MS,
  INIT_POLL_MAX_ATTEMPTS,
  PAYMENT_ORDER_ID_PARAM,
  PAYMENT_RESULT_PATH_SUFFIX,
  classifyPaymentFailure,
  isRetryableInitializationFailure,
  isValidPaymentOrderId,
  paymentPath,
  paymentRecoveryFor,
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

describe('classifyPaymentFailure', () => {
  it('classifies failed outcomes without a provider verdict as initialization failures', () => {
    expect(classifyPaymentFailure('failed', null)).toBe('initialization-failure');
    expect(classifyPaymentFailure('failed', undefined)).toBe('initialization-failure');
  });

  it('classifies failed outcomes with a provider verdict as confirmation failures', () => {
    expect(classifyPaymentFailure('failed', 'failed')).toBe('confirmation-failure');
    expect(classifyPaymentFailure('failed', 'succeeded')).toBe('confirmation-failure');
    expect(classifyPaymentFailure('failed', 'unknown')).toBe('confirmation-failure');
  });

  it('returns null outside the failed stage', () => {
    expect(classifyPaymentFailure('idle', null)).toBeNull();
    expect(classifyPaymentFailure('processing', 'unknown')).toBeNull();
    expect(classifyPaymentFailure('succeeded', 'succeeded')).toBeNull();
    expect(classifyPaymentFailure(null, null)).toBeNull();
    expect(classifyPaymentFailure(undefined, undefined)).toBeNull();
  });
});

describe('paymentRecoveryFor', () => {
  it('offers initialization retry for failed and cancelled flows', () => {
    expect(paymentRecoveryFor('failed', null)).toBe('retry-initialization');
    expect(paymentRecoveryFor('failed', 'failed')).toBe('retry-initialization');
    expect(paymentRecoveryFor('cancelled', 'cancelled')).toBe('retry-initialization');
    expect(paymentRecoveryFor('cancelled', null)).toBe('retry-initialization');
  });

  it('offers status checks for pending and unknown outcomes', () => {
    expect(paymentRecoveryFor('pending', null)).toBe('check-status');
    expect(paymentRecoveryFor('pending', 'pending')).toBe('check-status');
    expect(paymentRecoveryFor('processing', 'unknown')).toBe('check-status');
  });

  it('offers no recovery for active, in-flight, and resolved stages', () => {
    expect(paymentRecoveryFor('idle', null)).toBe('none');
    expect(paymentRecoveryFor('initializing', null)).toBe('none');
    expect(paymentRecoveryFor('ready', null)).toBe('none');
    expect(paymentRecoveryFor('processing', null)).toBe('none');
    expect(paymentRecoveryFor('processing', 'pending')).toBe('none');
    expect(paymentRecoveryFor('succeeded', 'succeeded')).toBe('none');
    expect(paymentRecoveryFor(null, null)).toBe('none');
    expect(paymentRecoveryFor('Refunding', 'unknown')).toBe('none');
  });
});

describe('initialization readiness-poll budget', () => {
  it('pins a fixed interval with a bounded attempt cap', () => {
    expect(INIT_POLL_INTERVAL_MS).toBe(2000);
    expect(INIT_POLL_MAX_ATTEMPTS).toBe(15);
  });
});

describe('isRetryableInitializationFailure', () => {
  function failure(status: number, code?: string): ApiError {
    return new ApiError({ status, code: code ?? 'X', message: 'x' });
  }

  it('retries transport loss, throttling, and overload statuses', () => {
    expect(isRetryableInitializationFailure(failure(0))).toBe(true);
    expect(isRetryableInitializationFailure(failure(408))).toBe(true);
    expect(isRetryableInitializationFailure(failure(429))).toBe(true);
    expect(isRetryableInitializationFailure(failure(500, 'Payment.ProviderUnavailable'))).toBe(
      true,
    );
    expect(isRetryableInitializationFailure(failure(502))).toBe(true);
    expect(isRetryableInitializationFailure(failure(503))).toBe(true);
  });

  it('retries provider-outage 400s on the bodiless by-order path', () => {
    expect(isRetryableInitializationFailure(failure(400, 'Payment.ProviderUnavailable'))).toBe(
      true,
    );
    expect(isRetryableInitializationFailure(new ApiError({ status: 400, message: 'x' }))).toBe(
      true,
    );
  });

  it('retries saga-lag 404s of any code, including codeless and masked reads', () => {
    expect(isRetryableInitializationFailure(failure(404, 'Payment.NotFound'))).toBe(true);
    expect(isRetryableInitializationFailure(new ApiError({ status: 404, message: 'x' }))).toBe(
      true,
    );
  });

  it('retries 409 only for the NotReady saga-lag code', () => {
    expect(isRetryableInitializationFailure(failure(409, 'Payment.NotReady'))).toBe(true);
    expect(isRetryableInitializationFailure(failure(409, 'Payment.NotPayable'))).toBe(false);
    expect(isRetryableInitializationFailure(failure(409, 'Anything.Else'))).toBe(false);
  });

  it('treats backend decisions as terminal', () => {
    expect(isRetryableInitializationFailure(failure(401))).toBe(false);
    expect(isRetryableInitializationFailure(failure(403))).toBe(false);
  });

  it('treats non-ApiError throwables as terminal (never spin on a bug)', () => {
    expect(isRetryableInitializationFailure(new Error('boom'))).toBe(false);
    expect(isRetryableInitializationFailure(null)).toBe(false);
    expect(isRetryableInitializationFailure(undefined)).toBe(false);
    expect(isRetryableInitializationFailure('404')).toBe(false);
  });
});
