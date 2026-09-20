import { describe, expect, it } from 'vitest';
import {
  BACKEND_PAYMENT_RESPONSIBILITIES,
  FORBIDDEN_CLIENT_SECRET_SINKS,
  FRONTEND_PAYMENT_RESPONSIBILITIES,
  PAYMENT_INIT_HTTP_AVAILABLE,
  PAYMENT_STATUS_PATH,
  PAYMENT_STATUS_QUERY_ERROR_CODES,
  PROVIDER_CONFIRMATION_OUTCOMES,
  SPA_CALLABLE_PAYMENT_ENDPOINTS,
  SPA_STRIPE_KEY_SLOT,
  TERMINAL_PAYMENT_STATUSES,
  isBackendPaymentResponsibility,
  isFailedPaymentStatus,
  isForbiddenClientSecretSink,
  isFrontendPaymentResponsibility,
  isInFlightPaymentStatus,
  isPayablePaymentStatus,
  isPaymentAuthFailure,
  isPaymentInitializationAvailable,
  isPaymentNotFoundFailure,
  isPaymentStatusQueryErrorCode,
  isProviderConfirmationOutcome,
  isSpaCallablePaymentEndpoint,
  isSuccessfulPaymentStatus,
  isTerminalPaymentStatus,
  isValidPaymentConfirmationInput,
  isValidPaymentInitializationRequest,
  isValidPaymentStatusQuery,
  orderPaymentProxyOf,
  paymentStatusOf,
  toPaymentAttempt,
  toPaymentAttemptFromOrder,
  type Payment,
  type PaymentAttempt,
  type PaymentOrder,
} from './payment-contract';

const ORDER_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const PAYMENT_ID = '4fa85f64-5717-4562-b3fc-2c963f66afa6';

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: PAYMENT_ID,
    orderId: ORDER_ID,
    customerId: '5fa85f64-5717-4562-b3fc-2c963f66afa6',
    amount: 59.98,
    currency: 'USD',
    status: 'Pending',
    providerPaymentIntentId: 'pi_123',
    provider: 'stripe',
    createdAtUtc: '2026-09-04T10:00:00Z',
    updatedAtUtc: null,
    version: 1,
    ...overrides,
  };
}

function order(overrides: Partial<PaymentOrder> = {}): PaymentOrder {
  return {
    orderId: ORDER_ID,
    orderNumber: 'ORD-ABC123DEF456',
    status: 'Pending',
    subtotal: { amount: 59.98, currency: 'USD' },
    shippingCost: { amount: 0, currency: 'USD' },
    discount: { amount: 0, currency: 'USD' },
    grandTotal: { amount: 59.98, currency: 'USD' },
    itemCount: 2,
    createdAtUtc: '2026-09-04T10:00:00Z',
    shippingAddress: {
      recipientName: 'Ada Lovelace',
      line1: '1 Flux St',
      line2: null,
      city: 'Berlin',
      region: 'BE',
      postalCode: '10115',
      countryCode: 'DE',
    },
    billingAddress: {
      recipientName: 'Ada Lovelace',
      line1: '1 Flux St',
      line2: null,
      city: 'Berlin',
      region: 'BE',
      postalCode: '10115',
      countryCode: 'DE',
    },
    lineItems: [],
    ...overrides,
  };
}

describe('payment initialization contract (live by-order HTTP path)', () => {
  it('pins the client-secret HTTP path as available', () => {
    expect(PAYMENT_INIT_HTTP_AVAILABLE).toBe(true);
    expect(isPaymentInitializationAvailable()).toBe(true);
  });

  it('accepts a well-formed initialization request shape', () => {
    expect(isValidPaymentInitializationRequest({ orderId: ORDER_ID })).toBe(true);
  });

  it('rejects missing, blank, or non-string order ids', () => {
    expect(isValidPaymentInitializationRequest(null)).toBe(false);
    expect(isValidPaymentInitializationRequest(undefined)).toBe(false);
    expect(isValidPaymentInitializationRequest({ orderId: '' })).toBe(false);
    expect(isValidPaymentInitializationRequest({ orderId: '   ' })).toBe(false);
  });
});

describe('payment status query contract', () => {
  it('targets the single SPA-callable payment path', () => {
    expect(PAYMENT_STATUS_PATH).toBe('/api/payments/{paymentId}');
  });

  it('accepts a well-formed status query', () => {
    expect(isValidPaymentStatusQuery({ paymentId: PAYMENT_ID })).toBe(true);
  });

  it('rejects missing or blank payment ids', () => {
    expect(isValidPaymentStatusQuery(null)).toBe(false);
    expect(isValidPaymentStatusQuery(undefined)).toBe(false);
    expect(isValidPaymentStatusQuery({ paymentId: '' })).toBe(false);
    expect(isValidPaymentStatusQuery({ paymentId: '   ' })).toBe(false);
  });

  it('projects the status out of a payment payload', () => {
    expect(paymentStatusOf(payment({ status: 'Succeeded' }))).toBe('Succeeded');
    expect(paymentStatusOf(payment({ status: 'Processing' }))).toBe('Processing');
  });

  it('returns null for a missing payload', () => {
    expect(paymentStatusOf(null)).toBeNull();
    expect(paymentStatusOf(undefined)).toBeNull();
  });
});

describe('payment confirmation expectations', () => {
  it('declares the closed provider-outcome set', () => {
    expect([...PROVIDER_CONFIRMATION_OUTCOMES]).toEqual([
      'succeeded',
      'failed',
      'cancelled',
      'requiresAction',
      'pending',
      'unknown',
    ]);
  });

  it('recognizes every declared outcome and rejects impostors', () => {
    for (const outcome of PROVIDER_CONFIRMATION_OUTCOMES) {
      expect(isProviderConfirmationOutcome(outcome)).toBe(true);
    }
    expect(isProviderConfirmationOutcome('verified')).toBe(false);
    expect(isProviderConfirmationOutcome('Confirmed')).toBe(false);
    expect(isProviderConfirmationOutcome(null)).toBe(false);
    expect(isProviderConfirmationOutcome(42)).toBe(false);
  });

  it('accepts a non-blank client secret and rejects blanks', () => {
    expect(isValidPaymentConfirmationInput({ clientSecret: 'pi_123_secret_abc' })).toBe(true);
    expect(isValidPaymentConfirmationInput(null)).toBe(false);
    expect(isValidPaymentConfirmationInput(undefined)).toBe(false);
    expect(isValidPaymentConfirmationInput({ clientSecret: '' })).toBe(false);
    expect(isValidPaymentConfirmationInput({ clientSecret: '   ' })).toBe(false);
  });
});

describe('PaymentAttempt observation records', () => {
  it('records a status-query observation verbatim', () => {
    const attempt = toPaymentAttempt(
      payment({ status: 'Processing' }),
      'status-query',
      '2026-09-04T10:01:00Z',
    );
    expect(attempt).toEqual({
      orderId: ORDER_ID,
      paymentId: PAYMENT_ID,
      status: 'Processing',
      providerReference: 'pi_123',
      source: 'status-query',
      observedAtUtc: '2026-09-04T10:01:00Z',
    } satisfies PaymentAttempt);
  });

  it('nulls the provider reference when the backend has none yet', () => {
    const attempt = toPaymentAttempt(
      payment({ providerPaymentIntentId: null }),
      'provider-confirmation',
      '2026-09-04T10:01:00Z',
    );
    expect(attempt?.providerReference).toBeNull();
  });

  it('returns null for a missing payload', () => {
    expect(toPaymentAttempt(null, 'status-query', '2026-09-04T10:01:00Z')).toBeNull();
    expect(toPaymentAttempt(undefined, 'status-query', '2026-09-04T10:01:00Z')).toBeNull();
  });

  it('proxies Confirmed orders to paid and Cancelled orders to not-paid', () => {
    expect(toPaymentAttemptFromOrder(order({ status: 'Confirmed' }), 't')?.status).toBe(
      'Succeeded',
    );
    expect(toPaymentAttemptFromOrder(order({ status: 'Cancelled' }), 't')?.status).toBe('Failed');
    expect(toPaymentAttemptFromOrder(order({ status: 'Pending' }), 't')?.status).toBe('Pending');
  });

  it('marks order-poll observations as payment-id-unknown', () => {
    const attempt = toPaymentAttemptFromOrder(order(), 't');
    expect(attempt?.paymentId).toBeNull();
    expect(attempt?.source).toBe('order-poll');
    expect(attempt?.providerReference).toBeNull();
  });

  it('returns null for a missing order', () => {
    expect(toPaymentAttemptFromOrder(null, 't')).toBeNull();
    expect(toPaymentAttemptFromOrder(undefined, 't')).toBeNull();
  });
});

describe('PaymentStatus classifiers', () => {
  it('declares the terminal set without the in-flight states', () => {
    expect([...TERMINAL_PAYMENT_STATUSES]).toEqual([
      'Succeeded',
      'Failed',
      'Cancelled',
      'Refunded',
    ]);
  });

  it('treats terminal states as terminal and in-flight states as not', () => {
    for (const status of TERMINAL_PAYMENT_STATUSES) {
      expect(isTerminalPaymentStatus(status)).toBe(true);
    }
    expect(isTerminalPaymentStatus('Pending')).toBe(false);
    expect(isTerminalPaymentStatus('Processing')).toBe(false);
  });

  it('treats unknown future statuses as non-terminal (keep polling)', () => {
    expect(isTerminalPaymentStatus('Refunding')).toBe(false);
    expect(isTerminalPaymentStatus('')).toBe(false);
  });

  it('recognizes backend-confirmed success only', () => {
    expect(isSuccessfulPaymentStatus('Succeeded')).toBe(true);
    expect(isSuccessfulPaymentStatus('Pending')).toBe(false);
    expect(isSuccessfulPaymentStatus('Processing')).toBe(false);
    expect(isSuccessfulPaymentStatus('Refunded')).toBe(false);
  });

  it('recognizes retryable failures without admitting refunds', () => {
    expect(isFailedPaymentStatus('Failed')).toBe(true);
    expect(isFailedPaymentStatus('Cancelled')).toBe(true);
    expect(isFailedPaymentStatus('Refunded')).toBe(false);
    expect(isFailedPaymentStatus('Succeeded')).toBe(false);
    expect(isFailedPaymentStatus('Pending')).toBe(false);
  });

  it('gates duplicate confirmation on payable states', () => {
    expect(isPayablePaymentStatus('Pending')).toBe(true);
    expect(isPayablePaymentStatus('Processing')).toBe(true);
    expect(isPayablePaymentStatus('Succeeded')).toBe(false);
    expect(isPayablePaymentStatus('Failed')).toBe(false);
    expect(isPayablePaymentStatus('Cancelled')).toBe(false);
    expect(isPayablePaymentStatus('Refunded')).toBe(false);
  });

  it('flags in-flight states for spinner display', () => {
    expect(isInFlightPaymentStatus('Pending')).toBe(true);
    expect(isInFlightPaymentStatus('Processing')).toBe(true);
    expect(isInFlightPaymentStatus('Succeeded')).toBe(false);
    expect(isInFlightPaymentStatus('Failed')).toBe(false);
  });

  it('maps order statuses to the payment proxy reading', () => {
    expect(orderPaymentProxyOf('Pending')).toBe('in-flight');
    expect(orderPaymentProxyOf('Confirmed')).toBe('paid');
    expect(orderPaymentProxyOf('Cancelled')).toBe('not-paid');
    expect(orderPaymentProxyOf('UnknownFuture')).toBe('in-flight');
  });
});

describe('payment error codes', () => {
  it('declares the closed status-query code set', () => {
    expect([...PAYMENT_STATUS_QUERY_ERROR_CODES]).toEqual([
      'Payment.NotFound',
      'Payment.Unauthorized',
      'Payment.InvalidRequest',
      'Payment.StripeError',
    ]);
  });

  it('recognizes declared codes and rejects impostors', () => {
    for (const code of PAYMENT_STATUS_QUERY_ERROR_CODES) {
      expect(isPaymentStatusQueryErrorCode(code)).toBe(true);
    }
    expect(isPaymentStatusQueryErrorCode('Order.NotFound')).toBe(false);
    expect(isPaymentStatusQueryErrorCode(null)).toBe(false);
  });

  it('classifies masked 404s (unknown id or foreign id)', () => {
    expect(isPaymentNotFoundFailure({ status: 404 })).toBe(true);
    expect(isPaymentNotFoundFailure({ status: 404, code: 'Payment.NotFound' })).toBe(true);
    expect(isPaymentNotFoundFailure({ status: 401 })).toBe(false);
    expect(isPaymentNotFoundFailure(null)).toBe(false);
    expect(isPaymentNotFoundFailure(undefined)).toBe(false);
  });

  it('classifies 401s as authentication failures', () => {
    expect(isPaymentAuthFailure({ status: 401 })).toBe(true);
    expect(isPaymentAuthFailure({ status: 404 })).toBe(false);
    expect(isPaymentAuthFailure(null)).toBe(false);
  });
});

describe('responsibility boundary (Frontend UX vs. Backend Truth)', () => {
  it('declares the frontend-owned concerns without backend truth', () => {
    expect([...FRONTEND_PAYMENT_RESPONSIBILITIES]).toEqual([
      'payment-ux',
      'provider-integration',
      'feature-state',
      'payment-result-display',
      'navigation',
      'loading-error-handling',
    ]);
  });

  it('declares the backend-owned concerns including saga and idempotency', () => {
    expect([...BACKEND_PAYMENT_RESPONSIBILITIES]).toEqual([
      'payment-creation',
      'status-verification',
      'webhook-processing',
      'order-transitions',
      'inventory-coordination',
      'saga-orchestration',
      'compensation',
      'idempotency',
    ]);
  });

  it('keeps the two responsibility sets disjoint (zero duplication)', () => {
    const frontend = new Set<string>(FRONTEND_PAYMENT_RESPONSIBILITIES);
    for (const concern of BACKEND_PAYMENT_RESPONSIBILITIES) {
      expect(frontend.has(concern)).toBe(false);
    }
  });

  it('classifies frontend concerns and rejects backend ones', () => {
    expect(isFrontendPaymentResponsibility('payment-ux')).toBe(true);
    expect(isFrontendPaymentResponsibility('navigation')).toBe(true);
    expect(isFrontendPaymentResponsibility('saga-orchestration')).toBe(false);
    expect(isFrontendPaymentResponsibility('status-verification')).toBe(false);
    expect(isFrontendPaymentResponsibility(null)).toBe(false);
  });

  it('classifies backend concerns and rejects frontend ones', () => {
    expect(isBackendPaymentResponsibility('saga-orchestration')).toBe(true);
    expect(isBackendPaymentResponsibility('webhook-processing')).toBe(true);
    expect(isBackendPaymentResponsibility('idempotency')).toBe(true);
    expect(isBackendPaymentResponsibility('payment-ux')).toBe(false);
    expect(isBackendPaymentResponsibility('navigation')).toBe(false);
    expect(isBackendPaymentResponsibility(undefined)).toBe(false);
  });

  it('exposes exactly two SPA-callable payment endpoints', () => {
    expect([...SPA_CALLABLE_PAYMENT_ENDPOINTS]).toEqual([
      '/api/payments/{paymentId}',
      '/api/payments/by-order/{orderId}',
    ]);
    expect(isSpaCallablePaymentEndpoint('/api/payments/{paymentId}')).toBe(true);
    expect(isSpaCallablePaymentEndpoint('/api/payments/by-order/{orderId}')).toBe(true);
    expect(isSpaCallablePaymentEndpoint('/api/payments/webhook')).toBe(false);
    expect(isSpaCallablePaymentEndpoint(null)).toBe(false);
    expect(isSpaCallablePaymentEndpoint(undefined)).toBe(false);
  });
});

describe('sensitive-data pins', () => {
  it('forbids every persistent or observable client-secret sink', () => {
    expect([...FORBIDDEN_CLIENT_SECRET_SINKS]).toEqual([
      'localStorage',
      'sessionStorage',
      'url',
      'logs',
      'telemetry',
      'persistent-global-state',
    ]);
  });

  it('flags forbidden sinks and admits memory-only handling', () => {
    for (const sink of FORBIDDEN_CLIENT_SECRET_SINKS) {
      expect(isForbiddenClientSecretSink(sink)).toBe(true);
    }
    expect(isForbiddenClientSecretSink('memory')).toBe(false);
    expect(isForbiddenClientSecretSink(null)).toBe(false);
  });

  it('pins the publishable key as the only SPA-held Stripe key', () => {
    expect(SPA_STRIPE_KEY_SLOT).toBe('publishable-key-from-app-env');
  });
});
