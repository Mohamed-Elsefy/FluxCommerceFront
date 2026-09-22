/**
 * Unit tests for the Sub-Phase 10.1 orders feature models.
 *
 * Covers the pure helpers only (currency reads, pagination bounds,
 * route-param shapes, independent status predicates, history-support
 * pin, error-code guards, status-first failure classifiers). Contract
 * mirrors themselves live in `@flux/models` (already covered by Phase 1
 * specs) and are aliased here — never re-declared — so these tests
 * assert the aliasing compiles and the helpers behave, not backend
 * shapes.
 *
 * Backend-authoritative pins: no helper under test multiplies prices or
 * sums amounts; order status and payment status are classified
 * independently (no cross-derivation); history display stays pinned
 * unsupported until the backend lands a history contract.
 */

import { describe, expect, it } from 'vitest';
import type { ParamMap } from '@angular/router';
import type { CustomerProfile, Order, OrderItem, OrderSummary } from './orders.models';
import {
  ORDERS_DEFAULT_PAGE_NUMBER,
  ORDERS_DEFAULT_PAGE_SIZE,
  ORDERS_ERROR_CODES,
  ORDERS_HISTORY_SUPPORTED,
  ORDERS_LIST_PATH,
  ORDERS_MAX_PAGE_SIZE,
  ORDERS_MIN_PAGE_NUMBER,
  ORDERS_MIN_PAGE_SIZE,
  ORDERS_ORDER_ID_PARAM,
  ORDERS_PAYMENT_STATUSES,
  ORDER_STATUSES,
  hasOrdersFieldErrors,
  isCancellableOrder,
  isCancelConflictFailure,
  isCancelledOrder,
  isConfirmedOrder,
  isOrderHistorySupported,
  isOrderStatus,
  isOrdersAccessDeniedFailure,
  isOrdersAuthFailure,
  isOrdersConflictFailure,
  isOrdersErrorCode,
  isOrdersNotFoundFailure,
  isOrdersPaymentStatus,
  isOrdersValidationFailure,
  isPendingOrder,
  isTerminalOrder,
  isValidOrderId,
  isValidOrdersQuery,
  orderCurrencyOf,
  orderDetailsPath,
  ordersPath,
  readOrdersRouteParams,
} from './orders.models';

const ORDER_ID = '11111111-1111-4111-8111-111111111111';

function summary(overrides: Partial<OrderSummary> = {}): OrderSummary {
  return {
    orderId: ORDER_ID,
    orderNumber: 'ORD-ABC123DEF456',
    status: 'Pending',
    grandTotal: { amount: 59.98, currency: 'USD' },
    itemCount: 2,
    createdAtUtc: '2026-09-04T10:00:00Z',
    ...overrides,
  };
}

function order(overrides: Partial<Order> = {}): Order {
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
    lineItems: [
      {
        productName: 'Tee',
        sku: 'TEE-BLK-M',
        quantity: 2,
        unitPrice: 29.99,
        unitPriceCurrency: 'USD',
        lineTotal: 59.98,
        lineTotalCurrency: 'USD',
      },
    ],
    ...overrides,
  };
}

function paramMap(orderId: string | null): ParamMap {
  return { get: (key: string) => (key === ORDERS_ORDER_ID_PARAM ? orderId : null) } as ParamMap;
}

describe('contract aliases compile against the backend shapes', () => {
  it('accepts a backend-shaped order summary as OrderSummary', () => {
    const value: OrderSummary = summary();
    expect(value.orderNumber).toBe('ORD-ABC123DEF456');
    expect(value.grandTotal.amount).toBe(59.98);
  });

  it('accepts a backend-shaped details payload as Order', () => {
    const value: Order = order();
    expect(value.lineItems).toHaveLength(1);
    expect(value.shippingAddress.countryCode).toBe('DE');
  });

  it('accepts a backend-shaped line item as OrderItem (split money, never nested)', () => {
    const item: OrderItem = order().lineItems[0];
    expect(item.unitPriceCurrency).toBe('USD');
    expect(item.lineTotalCurrency).toBe('USD');
    expect(item).not.toHaveProperty('grandTotal');
  });

  it('accepts a backend-shaped profile as CustomerProfile', () => {
    const profile: CustomerProfile = {
      id: '22222222-2222-4222-8222-222222222222',
      email: 'ada@flux.local',
      roles: ['Customer'],
      isEmailVerified: true,
      registeredAtUtc: '2026-09-04T10:00:00Z',
      firstName: 'Ada',
      lastName: 'Lovelace',
      displayName: 'Ada Lovelace',
      phoneNumber: null,
      isPhoneVerified: false,
      avatarUrl: null,
      preferredLanguage: 'en',
      timeZone: 'UTC',
      status: 1,
    };
    expect(profile.roles).toEqual(['Customer']);
  });
});

describe('orderCurrencyOf (read-only, no math)', () => {
  it('echoes the backend-issued grand-total currency', () => {
    expect(orderCurrencyOf(summary())).toBe('USD');
    expect(orderCurrencyOf(order())).toBe('USD');
  });

  it('resolves unknown currency for missing orders', () => {
    expect(orderCurrencyOf(null)).toBeNull();
    expect(orderCurrencyOf(undefined)).toBeNull();
  });
});

describe('orders pagination bounds', () => {
  it('pins the backend defaults and limits', () => {
    expect(ORDERS_DEFAULT_PAGE_NUMBER).toBe(1);
    expect(ORDERS_DEFAULT_PAGE_SIZE).toBe(20);
    expect(ORDERS_MIN_PAGE_NUMBER).toBe(1);
    expect(ORDERS_MIN_PAGE_SIZE).toBe(1);
    expect(ORDERS_MAX_PAGE_SIZE).toBe(100);
  });

  it('accepts absent queries (backend defaults apply)', () => {
    expect(isValidOrdersQuery(null)).toBe(true);
    expect(isValidOrdersQuery(undefined)).toBe(true);
    expect(isValidOrdersQuery({})).toBe(true);
    expect(isValidOrdersQuery({ pageNumber: 1, pageSize: 20 })).toBe(true);
    expect(isValidOrdersQuery({ pageNumber: 3, pageSize: 100 })).toBe(true);
  });

  it('rejects out-of-contract paging without throwing', () => {
    expect(isValidOrdersQuery({ pageNumber: 0 })).toBe(false);
    expect(isValidOrdersQuery({ pageNumber: -2 })).toBe(false);
    expect(isValidOrdersQuery({ pageNumber: 1.5 })).toBe(false);
    expect(isValidOrdersQuery({ pageSize: 0 })).toBe(false);
    expect(isValidOrdersQuery({ pageSize: 101 })).toBe(false);
    expect(isValidOrdersQuery({ pageSize: 2.5 })).toBe(false);
    expect(isValidOrdersQuery({ pageNumber: Number.NaN })).toBe(false);
  });
});

describe('orders route params (shapes only)', () => {
  it('names the order id param', () => {
    expect(ORDERS_ORDER_ID_PARAM).toBe('orderId');
  });

  it('builds the proposed list and details paths', () => {
    expect(ORDERS_LIST_PATH).toBe('/account/orders');
    expect(ordersPath()).toBe('/account/orders');
    expect(orderDetailsPath(ORDER_ID)).toBe(`/account/orders/${ORDER_ID}`);
  });

  it('reads usable order ids out of the param map', () => {
    expect(readOrdersRouteParams(paramMap(ORDER_ID))).toEqual({ orderId: ORDER_ID });
  });

  it('returns null for missing or blank order ids (never fabricated)', () => {
    expect(readOrdersRouteParams(paramMap(null))).toBeNull();
    expect(readOrdersRouteParams(paramMap(''))).toBeNull();
    expect(readOrdersRouteParams(paramMap('   '))).toBeNull();
    expect(readOrdersRouteParams(null)).toBeNull();
    expect(readOrdersRouteParams(undefined)).toBeNull();
  });

  it('guards order ids structurally', () => {
    expect(isValidOrderId(ORDER_ID)).toBe(true);
    expect(isValidOrderId('')).toBe(false);
    expect(isValidOrderId('   ')).toBe(false);
    expect(isValidOrderId(null)).toBe(false);
    expect(isValidOrderId(42)).toBe(false);
  });
});

describe('order status predicates (independent — no cross-derivation)', () => {
  it('pins the closed string set Pending|Cancelled|Confirmed', () => {
    expect(ORDER_STATUSES).toEqual(['Pending', 'Cancelled', 'Confirmed']);
    expect(isOrderStatus('Pending')).toBe(true);
    expect(isOrderStatus('Confirmed')).toBe(true);
    expect(isOrderStatus('Refunding')).toBe(false);
    expect(isOrderStatus(1)).toBe(false);
    expect(isOrderStatus(null)).toBe(false);
  });

  it('classifies each lifecycle state separately', () => {
    expect(isPendingOrder('Pending')).toBe(true);
    expect(isPendingOrder('Confirmed')).toBe(false);
    expect(isConfirmedOrder('Confirmed')).toBe(true);
    expect(isConfirmedOrder('Pending')).toBe(false);
    expect(isCancelledOrder('Cancelled')).toBe(true);
    expect(isCancelledOrder('Pending')).toBe(false);
  });

  it('treats only Cancelled|Confirmed as terminal (unknown stays polling)', () => {
    expect(isTerminalOrder('Confirmed')).toBe(true);
    expect(isTerminalOrder('Cancelled')).toBe(true);
    expect(isTerminalOrder('Pending')).toBe(false);
    expect(isTerminalOrder('Refunding')).toBe(false);
  });

  it('allows customer cancel only while Pending', () => {
    expect(isCancellableOrder('Pending')).toBe(true);
    expect(isCancellableOrder('Confirmed')).toBe(false);
    expect(isCancellableOrder('Cancelled')).toBe(false);
  });

  it('keeps payment status as a separate closed set', () => {
    expect(ORDERS_PAYMENT_STATUSES).toEqual([
      'Pending',
      'Processing',
      'Succeeded',
      'Failed',
      'Cancelled',
      'Refunded',
    ]);
    expect(isOrdersPaymentStatus('Succeeded')).toBe(true);
    expect(isOrdersPaymentStatus('Confirmed')).toBe(false);
    expect(isOrdersPaymentStatus(null)).toBe(false);
  });
});

describe('order history support pin (audited gap)', () => {
  it('stays unsupported until the backend lands a history contract', () => {
    expect(ORDERS_HISTORY_SUPPORTED).toBe(false);
    expect(isOrderHistorySupported()).toBe(false);
  });
});

describe('orders error codes and status-first classifiers', () => {
  it('pins the closed machine-readable code set', () => {
    expect(ORDERS_ERROR_CODES).toContain('Order.NotFound');
    expect(ORDERS_ERROR_CODES).toContain('Order.CancelConflict');
    expect(ORDERS_ERROR_CODES).toContain('Order.ValidationFailed');
    expect(isOrdersErrorCode('Order.NotFound')).toBe(true);
    expect(isOrdersErrorCode('Payment.NotFound')).toBe(false);
    expect(isOrdersErrorCode(null)).toBe(false);
  });

  it('classifies validation, auth, denial, missing, and conflict by status', () => {
    expect(isOrdersValidationFailure({ status: 400 })).toBe(true);
    expect(isOrdersValidationFailure({ status: 404 })).toBe(false);
    expect(isOrdersAuthFailure({ status: 401 })).toBe(true);
    expect(isOrdersAuthFailure({ status: 403 })).toBe(false);
    expect(isOrdersAccessDeniedFailure({ status: 403 })).toBe(true);
    expect(isOrdersAccessDeniedFailure({ status: 404 })).toBe(false);
    expect(isOrdersNotFoundFailure({ status: 404 })).toBe(true);
    expect(isOrdersNotFoundFailure({ status: 401 })).toBe(false);
    expect(isOrdersConflictFailure({ status: 409 })).toBe(true);
    expect(isOrdersConflictFailure({ status: 400 })).toBe(false);
  });

  it('handles missing failures without throwing', () => {
    expect(isOrdersValidationFailure(null)).toBe(false);
    expect(isOrdersAuthFailure(undefined)).toBe(false);
    expect(isOrdersNotFoundFailure(null)).toBe(false);
    expect(isOrdersConflictFailure(undefined)).toBe(false);
  });

  it('exposes the 400 field-error map intact', () => {
    expect(hasOrdersFieldErrors({ status: 400, validationErrors: { city: ['x'] } })).toBe(true);
    expect(hasOrdersFieldErrors({ status: 400, validationErrors: {} })).toBe(false);
    expect(hasOrdersFieldErrors({ status: 400 })).toBe(false);
    expect(hasOrdersFieldErrors({ status: 404 })).toBe(false);
  });

  it('detects late-cancel conflicts, preferring the code hint', () => {
    expect(isCancelConflictFailure({ status: 409, code: 'Order.CancelConflict' })).toBe(true);
    expect(isCancelConflictFailure({ status: 409 })).toBe(true);
    expect(isCancelConflictFailure({ status: 409, code: 'Order.CurrencyMismatch' })).toBe(false);
    expect(isCancelConflictFailure({ status: 404, code: 'Order.CancelConflict' })).toBe(false);
    expect(isCancelConflictFailure(null)).toBe(false);
  });
});
