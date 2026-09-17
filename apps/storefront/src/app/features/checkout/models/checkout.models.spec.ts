/**
 * Unit tests for the Sub-Phase 8.1 checkout feature models.
 *
 * Covers the pure helpers only (customer projection, shipping-method gap,
 * idempotency/country/address bounds, address mapping, request building,
 * order-summary projection, error-code sets and classifiers). Contract
 * mirrors themselves live in `@flux/models` (already covered by Phase 1
 * specs) and are aliased here — never re-declared — so these tests assert
 * the aliasing compiles and the helpers behave, not backend shapes.
 *
 * Backend-authoritative totals pin: no helper under test multiplies
 * prices or sums amounts — money slots stay `null` until a backend
 * totals source provides them.
 */

import { describe, expect, it } from 'vitest';
import type { CartItemResponse, CartResponse } from '@flux/models';
import type {
  CheckoutAddress,
  CheckoutAddressInput,
  CreateOrderRequest,
  CreateOrderResponse,
} from './checkout.models';
import {
  buildCreateOrderRequest,
  CHECKOUT_ADDRESS_LINE_MAX_LENGTH,
  CHECKOUT_CITY_MAX_LENGTH,
  CHECKOUT_COUNTRY_CODE_LENGTH,
  CHECKOUT_ORDER_ERROR_CODES,
  CHECKOUT_POSTAL_CODE_MAX_LENGTH,
  CHECKOUT_RECIPIENT_NAME_MAX_LENGTH,
  CHECKOUT_REGION_MAX_LENGTH,
  CHECKOUT_SHIPPING_METHOD_SUPPORTED,
  checkoutRecoveryFor,
  emptyShippingSelection,
  hasBackendOrderTotals,
  hasCheckoutFieldErrors,
  IDEMPOTENCY_KEY_MAX_LENGTH,
  IDEMPOTENCY_KEY_MIN_LENGTH,
  isCheckoutAccessDeniedFailure,
  isCheckoutAuthFailure,
  isCheckoutConflictFailure,
  isCheckoutNotFoundFailure,
  isCheckoutOrderErrorCode,
  isCheckoutSummaryEmpty,
  isCheckoutValidationFailure,
  isFormPreservingCheckoutFailure,
  isIdempotencyConflictFailure,
  isShippingMethodSupported,
  isValidCheckoutAddress,
  isValidCountryCode,
  isValidIdempotencyKey,
  toCheckoutAddress,
  toCheckoutCustomerInfo,
  toCheckoutOrderSummary,
  toCheckoutSummaryLine,
} from './checkout.models';

const CART_ID = '11111111-1111-4111-8111-111111111111';

function line(overrides: Partial<CartItemResponse> = {}): CartItemResponse {
  return {
    productId: '22222222-2222-4222-8222-222222222222',
    variantId: 'aaaaaaaa-1111-4111-8111-111111111111',
    sku: 'TEE-BLK-M',
    productName: 'Tee',
    unitPriceAmount: 29.99,
    currency: 'USD',
    quantity: 2,
    ...overrides,
  };
}

function cart(overrides: Partial<CartResponse> = {}): CartResponse {
  return {
    cartId: CART_ID,
    userId: '33333333-3333-4333-8333-333333333333',
    version: 3,
    createdAtUtc: '2026-09-04T10:00:00Z',
    updatedAtUtc: '2026-09-04T10:05:00Z',
    items: [line()],
    isGuest: false,
    isAuthenticated: true,
    ...overrides,
  };
}

function addressInput(overrides: Partial<CheckoutAddressInput> = {}): CheckoutAddressInput {
  return {
    recipientName: 'Ada Lovelace',
    line1: '1 Flux St',
    line2: null,
    city: 'Berlin',
    region: 'BE',
    postalCode: '10115',
    countryCode: 'DE',
    ...overrides,
  };
}

describe('contract aliases (compile against @flux/models, never re-declared)', () => {
  it('accepts the backend checkout body shape as CreateOrderRequest', () => {
    const request: CreateOrderRequest = {
      cartId: CART_ID,
      shippingAddress: addressInput(),
      billingAddress: addressInput(),
    };
    expect(request.cartId).toBe(CART_ID);
  });

  it('accepts the backend checkout payload shape as CreateOrderResponse', () => {
    const response: CreateOrderResponse = {
      orderId: '44444444-4444-4444-8444-444444444444',
      orderNumber: 'ORD-ABC123DEF456',
      status: 'Pending',
      createdAtUtc: '2026-09-04T10:00:00Z',
    };
    expect(response.status).toBe('Pending');
  });
});

describe('customer information (projection of address recipientName only)', () => {
  it('projects the recipient name from a checkout address', () => {
    const address: CheckoutAddress = addressInput({ recipientName: 'Grace Hopper' });
    expect(toCheckoutCustomerInfo(address)).toEqual({ recipientName: 'Grace Hopper' });
  });
});

describe('shipping method gap (contract carries no method field)', () => {
  it('pins shipping-method selection as unsupported', () => {
    expect(CHECKOUT_SHIPPING_METHOD_SUPPORTED).toBe(false);
    expect(isShippingMethodSupported()).toBe(false);
  });

  it('provides the single empty shipping selection', () => {
    expect(emptyShippingSelection()).toEqual({});
  });
});

describe('contract length bounds', () => {
  it('mirrors the backend DataAnnotations caps', () => {
    expect(CHECKOUT_RECIPIENT_NAME_MAX_LENGTH).toBe(100);
    expect(CHECKOUT_ADDRESS_LINE_MAX_LENGTH).toBe(200);
    expect(CHECKOUT_CITY_MAX_LENGTH).toBe(100);
    expect(CHECKOUT_REGION_MAX_LENGTH).toBe(100);
    expect(CHECKOUT_POSTAL_CODE_MAX_LENGTH).toBe(20);
    expect(CHECKOUT_COUNTRY_CODE_LENGTH).toBe(2);
    expect(IDEMPOTENCY_KEY_MIN_LENGTH).toBe(1);
    expect(IDEMPOTENCY_KEY_MAX_LENGTH).toBe(128);
  });
});

describe('isValidIdempotencyKey (trimmed 1..128)', () => {
  it('accepts keys within bounds after trimming', () => {
    expect(isValidIdempotencyKey('k')).toBe(true);
    expect(isValidIdempotencyKey('a'.repeat(128))).toBe(true);
    expect(isValidIdempotencyKey('  k1  ')).toBe(true);
  });

  it('rejects missing, blank, and over-long keys without throwing', () => {
    expect(isValidIdempotencyKey(null)).toBe(false);
    expect(isValidIdempotencyKey(undefined)).toBe(false);
    expect(isValidIdempotencyKey('')).toBe(false);
    expect(isValidIdempotencyKey('   ')).toBe(false);
    expect(isValidIdempotencyKey('a'.repeat(129))).toBe(false);
  });
});

describe('isValidCountryCode (exactly 2 uppercase)', () => {
  it('accepts two uppercase ASCII letters', () => {
    expect(isValidCountryCode('DE')).toBe(true);
    expect(isValidCountryCode('US')).toBe(true);
  });

  it('rejects lowercase, long, short, and non-letter codes', () => {
    expect(isValidCountryCode('de')).toBe(false);
    expect(isValidCountryCode('USA')).toBe(false);
    expect(isValidCountryCode('D')).toBe(false);
    expect(isValidCountryCode('')).toBe(false);
    expect(isValidCountryCode('12')).toBe(false);
    expect(isValidCountryCode(null)).toBe(false);
    expect(isValidCountryCode(undefined)).toBe(false);
  });
});

describe('isValidCheckoutAddress (structural pre-check only)', () => {
  it('accepts a fully populated address', () => {
    expect(isValidCheckoutAddress(addressInput())).toBe(true);
  });

  it('accepts a missing optional line2', () => {
    expect(isValidCheckoutAddress(addressInput({ line2: null }))).toBe(true);
    expect(isValidCheckoutAddress(addressInput({ line2: undefined }))).toBe(true);
  });

  it('rejects missing addresses and blank required fields', () => {
    expect(isValidCheckoutAddress(null)).toBe(false);
    expect(isValidCheckoutAddress(undefined)).toBe(false);
    expect(isValidCheckoutAddress(addressInput({ recipientName: '   ' }))).toBe(false);
    expect(isValidCheckoutAddress(addressInput({ line1: '' }))).toBe(false);
    expect(isValidCheckoutAddress(addressInput({ city: '' }))).toBe(false);
    expect(isValidCheckoutAddress(addressInput({ region: '' }))).toBe(false);
    expect(isValidCheckoutAddress(addressInput({ postalCode: '' }))).toBe(false);
  });

  it('rejects over-length fields and bad country codes', () => {
    expect(isValidCheckoutAddress(addressInput({ recipientName: 'a'.repeat(101) }))).toBe(false);
    expect(isValidCheckoutAddress(addressInput({ line1: 'a'.repeat(201) }))).toBe(false);
    expect(isValidCheckoutAddress(addressInput({ line2: 'a'.repeat(201) }))).toBe(false);
    expect(isValidCheckoutAddress(addressInput({ postalCode: 'a'.repeat(21) }))).toBe(false);
    expect(isValidCheckoutAddress(addressInput({ countryCode: 'de' }))).toBe(false);
    expect(isValidCheckoutAddress(addressInput({ countryCode: 'DEU' }))).toBe(false);
  });
});

describe('toCheckoutAddress (form input → wire address)', () => {
  it('passes fields through verbatim', () => {
    expect(toCheckoutAddress(addressInput())).toEqual({
      recipientName: 'Ada Lovelace',
      line1: '1 Flux St',
      line2: null,
      city: 'Berlin',
      region: 'BE',
      postalCode: '10115',
      countryCode: 'DE',
    });
  });

  it('normalizes blank line2 to null for the wire', () => {
    expect(toCheckoutAddress(addressInput({ line2: '' })).line2).toBeNull();
    expect(toCheckoutAddress(addressInput({ line2: '   ' })).line2).toBeNull();
    expect(toCheckoutAddress(addressInput({ line2: 'Apt 4' })).line2).toBe('Apt 4');
  });
});

describe('buildCreateOrderRequest (form data → wire body)', () => {
  it('assembles the cart id plus both addresses', () => {
    const request = buildCreateOrderRequest(
      CART_ID,
      addressInput(),
      addressInput({ city: 'Paris', countryCode: 'FR' }),
    );
    expect(request.cartId).toBe(CART_ID);
    expect(request.shippingAddress.city).toBe('Berlin');
    expect(request.billingAddress.city).toBe('Paris');
    expect(request.billingAddress.countryCode).toBe('FR');
  });

  it('carries no idempotency key, no totals, and no shipping method', () => {
    const request = buildCreateOrderRequest(CART_ID, addressInput(), addressInput());
    expect(request).not.toHaveProperty('idempotencyKey');
    expect(request).not.toHaveProperty('subtotal');
    expect(request).not.toHaveProperty('shippingMethod');
  });
});

describe('checkout order summary (backend-authoritative, display only)', () => {
  it('projects display lines from backend-issued cart lines without totals', () => {
    expect(toCheckoutSummaryLine(line())).toEqual({
      productName: 'Tee',
      sku: 'TEE-BLK-M',
      quantity: 2,
      unitPriceAmount: 29.99,
      currency: 'USD',
    });
  });

  it('projects counts and currency with null money slots', () => {
    const summary = toCheckoutOrderSummary(cart());
    expect(summary?.cartId).toBe(CART_ID);
    expect(summary?.itemCount).toBe(2);
    expect(summary?.distinctItemCount).toBe(1);
    expect(summary?.currency).toBe('USD');
    expect(summary?.subtotal).toBeNull();
    expect(summary?.shippingCost).toBeNull();
    expect(summary?.discount).toBeNull();
    expect(summary?.grandTotal).toBeNull();
  });

  it('performs no local price math: priced lines still yield null money', () => {
    const summary = toCheckoutOrderSummary(
      cart({ items: [line({ quantity: 2 }), line({ quantity: 3 })] }),
    );
    expect(summary?.itemCount).toBe(5);
    expect(summary?.distinctItemCount).toBe(2);
    expect(summary?.subtotal).toBeNull();
    expect(summary?.grandTotal).toBeNull();
  });

  it('resolves unknown currency for empty and mixed carts', () => {
    expect(toCheckoutOrderSummary(cart({ items: [] }))?.currency).toBeNull();
    expect(
      toCheckoutOrderSummary(
        cart({ items: [line({ currency: 'USD' }), line({ currency: 'EUR' })] }),
      )?.currency,
    ).toBeNull();
  });

  it('returns null for a missing cart', () => {
    expect(toCheckoutOrderSummary(null)).toBeNull();
    expect(toCheckoutOrderSummary(undefined)).toBeNull();
  });

  it('reports absent backend money as absent (never zero-filled)', () => {
    expect(hasBackendOrderTotals(toCheckoutOrderSummary(cart()))).toBe(false);
    expect(hasBackendOrderTotals(null)).toBe(false);
    expect(hasBackendOrderTotals(undefined)).toBe(false);
    const withMoney = {
      ...toCheckoutOrderSummary(cart())!,
      subtotal: { amount: 59.98, currency: 'USD' },
      grandTotal: { amount: 59.98, currency: 'USD' },
    };
    expect(hasBackendOrderTotals(withMoney)).toBe(true);
  });

  it('treats missing and line-free summaries as empty', () => {
    expect(isCheckoutSummaryEmpty(null)).toBe(true);
    expect(isCheckoutSummaryEmpty(undefined)).toBe(true);
    expect(isCheckoutSummaryEmpty(toCheckoutOrderSummary(cart({ items: [] })))).toBe(true);
    expect(isCheckoutSummaryEmpty(toCheckoutOrderSummary(cart()))).toBe(false);
  });
});

describe('checkout error codes and classifiers (status-first, never message text)', () => {
  it('declares the closed checkout error-code set', () => {
    expect([...CHECKOUT_ORDER_ERROR_CODES]).toEqual([
      'Order.InvalidIdempotencyKey',
      'Order.CartEmpty',
      'Order.InvalidAddress',
      'Order.ValidationFailed',
      'Order.IdempotencyConflict',
      'Order.VariantUnavailable',
      'Order.DuplicateVariant',
      'Order.CurrencyMismatch',
      'Order.AuthenticationRequired',
      'Order.QueryAuthenticationRequired',
      'Order.CartAccessDenied',
      'Order.CartNotFound',
      'Order.NotFound',
    ]);
  });

  it('narrows error codes without throwing', () => {
    expect(isCheckoutOrderErrorCode('Order.CartEmpty')).toBe(true);
    expect(isCheckoutOrderErrorCode('Order.IdempotencyConflict')).toBe(true);
    expect(isCheckoutOrderErrorCode('Cart.CartNotFound')).toBe(false);
    expect(isCheckoutOrderErrorCode(null)).toBe(false);
    expect(isCheckoutOrderErrorCode(undefined)).toBe(false);
    expect(isCheckoutOrderErrorCode('')).toBe(false);
  });

  it('classifies validation, conflict, auth, denial, and missing failures by status', () => {
    expect(isCheckoutValidationFailure({ status: 400 })).toBe(true);
    expect(isCheckoutValidationFailure({ status: 409 })).toBe(false);
    expect(isCheckoutValidationFailure(null)).toBe(false);
    expect(isCheckoutConflictFailure({ status: 409 })).toBe(true);
    expect(isCheckoutConflictFailure({ status: 400 })).toBe(false);
    expect(isCheckoutAuthFailure({ status: 401 })).toBe(true);
    expect(isCheckoutAuthFailure({ status: 403 })).toBe(false);
    expect(isCheckoutAccessDeniedFailure({ status: 403 })).toBe(true);
    expect(isCheckoutAccessDeniedFailure({ status: 404 })).toBe(false);
    expect(isCheckoutNotFoundFailure({ status: 404 })).toBe(true);
    expect(isCheckoutNotFoundFailure(null)).toBe(false);
  });

  it('detects field-level validation maps on 400 only', () => {
    expect(hasCheckoutFieldErrors({ status: 400, validationErrors: { city: ['Required.'] } })).toBe(
      true,
    );
    expect(hasCheckoutFieldErrors({ status: 400, validationErrors: {} })).toBe(false);
    expect(hasCheckoutFieldErrors({ status: 400 })).toBe(false);
    expect(hasCheckoutFieldErrors({ status: 409, validationErrors: { city: ['Required.'] } })).toBe(
      false,
    );
  });

  it('identifies idempotency conflicts on 409 (code hint preferred, status fallback)', () => {
    expect(isIdempotencyConflictFailure({ status: 409, code: 'Order.IdempotencyConflict' })).toBe(
      true,
    );
    expect(isIdempotencyConflictFailure({ status: 409 })).toBe(true);
    expect(isIdempotencyConflictFailure({ status: 409, code: 'Order.CurrencyMismatch' })).toBe(
      false,
    );
    expect(isIdempotencyConflictFailure({ status: 400, code: 'Order.IdempotencyConflict' })).toBe(
      false,
    );
    expect(isIdempotencyConflictFailure(null)).toBe(false);
  });

  it('preserves form data on 4xx rejections but not on transport failures', () => {
    expect(isFormPreservingCheckoutFailure({ status: 400 })).toBe(true);
    expect(isFormPreservingCheckoutFailure({ status: 409 })).toBe(true);
    expect(isFormPreservingCheckoutFailure({ status: 404 })).toBe(true);
    expect(isFormPreservingCheckoutFailure({ status: 0 })).toBe(false);
    expect(isFormPreservingCheckoutFailure({ status: 500 })).toBe(false);
    expect(isFormPreservingCheckoutFailure(null)).toBe(false);
    expect(isFormPreservingCheckoutFailure(undefined)).toBe(false);
  });

  it('routes transport failures to same-key retry', () => {
    expect(checkoutRecoveryFor({ status: 0 })).toBe('retry');
    expect(checkoutRecoveryFor({ status: 0, code: 'NetworkError' })).toBe('retry');
  });

  it('routes missing and denied carts to the back-to-cart path', () => {
    expect(checkoutRecoveryFor({ status: 404 })).toBe('cart');
    expect(checkoutRecoveryFor({ status: 403 })).toBe('cart');
  });

  it('routes validation, business, auth, and server failures to edit-and-resubmit', () => {
    expect(checkoutRecoveryFor({ status: 400 })).toBe('edit');
    expect(checkoutRecoveryFor({ status: 401 })).toBe('edit');
    expect(checkoutRecoveryFor({ status: 409 })).toBe('edit');
    expect(checkoutRecoveryFor({ status: 500 })).toBe('edit');
  });

  it('maps no failure to no recovery', () => {
    expect(checkoutRecoveryFor(null)).toBeNull();
    expect(checkoutRecoveryFor(undefined)).toBeNull();
  });
});
