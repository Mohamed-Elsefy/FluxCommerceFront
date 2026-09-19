/**
 * Page tests for the Sub-Phase 9.8 `PaymentResultPage` outcome hub plus
 * the Sub-Phase 9.10 UI pass (localized copy, error resolution, order
 * summary, document title).
 *
 * Covers result presentation: per-outcome blocks (success with order
 * reference, failure/cancelled with navigation options, pending with
 * manual verification, neutral fallback), backend verification on entry
 * for success/pending claims, and server-platform silence. The
 * `PaymentApiService` is stubbed at its seam — this spec owns the page
 * orchestration around state and routing.
 */

import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { EMPTY, of, type Observable } from 'rxjs';
import { ApiError, type ApiResponseWithData } from '@flux/api';
import type { Payment } from '@flux/models';
import { PaymentApiService } from '../../data-access/payment-api.service';
import { PAYMENT_PROVIDER } from '../../integrations/payment-provider';
import { PaymentState } from '../../state/payment-state';
import { PaymentResultPage } from './payment-result-page';

const ORDER_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const PAYMENT_ID = '4fa85f64-5717-4562-b3fc-2c963f66afa6';

function payment(status: Payment['status']): Payment {
  return {
    id: PAYMENT_ID,
    orderId: ORDER_ID,
    customerId: '5fa85f64-5717-4562-b3fc-2c963f66afa6',
    amount: 59.98,
    currency: 'USD',
    status,
    providerPaymentIntentId: 'pi_123',
    provider: 'stripe',
    createdAtUtc: '2026-09-04T10:00:00Z',
    updatedAtUtc: '2026-09-04T10:01:00Z',
    version: 3,
  };
}

function statusEnvelope(status: Payment['status']): ApiResponseWithData<Payment> {
  return { isSuccess: true, message: 'ok', data: payment(status) };
}

function toSucceeded(state: PaymentState): void {
  expect(state.beginInitialization(ORDER_ID)).toBe(true);
  expect(
    state.markReady({ paymentId: PAYMENT_ID, clientSecret: 'secret', paymentStatus: 'Pending' }),
  ).toBe(true);
  expect(state.beginProcessing()).toBe(true);
  expect(state.markSucceeded('Succeeded')).toBe(true);
}

function toPending(state: PaymentState): void {
  expect(state.beginInitialization(ORDER_ID)).toBe(true);
  expect(
    state.markReady({ paymentId: PAYMENT_ID, clientSecret: 'secret', paymentStatus: 'Pending' }),
  ).toBe(true);
  expect(state.beginProcessing()).toBe(true);
  expect(state.markPending()).toBe(true);
}

function toUnknown(state: PaymentState): void {
  expect(state.beginInitialization(ORDER_ID)).toBe(true);
  expect(
    state.markReady({ paymentId: PAYMENT_ID, clientSecret: 'secret', paymentStatus: 'Pending' }),
  ).toBe(true);
  expect(state.beginProcessing()).toBe(true);
  state.applyProviderResult({ outcome: 'unknown', message: null });
  expect(state.lifecycle()).toBe('processing');
}

function setup(options: {
  orderId?: string | null;
  platform?: string;
  statusFlow?: () => Observable<ApiResponseWithData<Payment>>;
  orderFlow?: () => Observable<unknown>;
  enter?: (state: PaymentState) => void;
}): {
  fixture: ComponentFixture<PaymentResultPage>;
  element: HTMLElement;
  state: PaymentState;
  getPaymentStatus: ReturnType<typeof vi.fn>;
} {
  TestBed.resetTestingModule();
  const getPaymentStatus = vi.fn(options.statusFlow ?? (() => of(statusEnvelope('Succeeded'))));
  const getOrderDetails = vi.fn(options.orderFlow ?? (() => EMPTY));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      PaymentState,
      {
        provide: PaymentApiService,
        useValue: { initializePayment: () => EMPTY, getPaymentStatus, getOrderDetails },
      },
      { provide: PAYMENT_PROVIDER, useValue: { confirmPayment: () => EMPTY } },
      { provide: PLATFORM_ID, useValue: options.platform ?? 'browser' },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            paramMap:
              options.orderId === null || options.orderId === undefined
                ? convertToParamMap({})
                : convertToParamMap({ orderId: options.orderId }),
          },
        },
      },
    ],
  });
  const state = TestBed.inject(PaymentState);
  options.enter?.(state);
  const fixture = TestBed.createComponent(PaymentResultPage);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement, state, getPaymentStatus };
}

function links(element: HTMLElement): Array<string | null> {
  return [...element.querySelectorAll('.payment-result-link')].map((link) =>
    link.getAttribute('href'),
  );
}

describe('PaymentResultPage entry', () => {
  it('renders the missing-reference fallback without contacting state', () => {
    const { element, getPaymentStatus } = setup({ orderId: null });
    expect(element.querySelector('.payment-result-page-missing')).not.toBeNull();
    expect(element.querySelector('.payment-result-success')).toBeNull();
    expect(getPaymentStatus).not.toHaveBeenCalled();
  });

  it('renders the neutral fallback for unresolved flows without verifying', () => {
    const { element, getPaymentStatus } = setup({ orderId: ORDER_ID });
    expect(element.querySelector('.payment-result-waiting')).not.toBeNull();
    expect(links(element)).toContain(`/payment/${ORDER_ID}`);
    expect(getPaymentStatus).not.toHaveBeenCalled();
  });

  it('stays silent on the server (no verification reads)', () => {
    const { element, getPaymentStatus } = setup({
      orderId: ORDER_ID,
      platform: 'server',
      enter: toSucceeded,
    });
    expect(element.querySelector('.payment-result-success')).not.toBeNull();
    expect(getPaymentStatus).not.toHaveBeenCalled();
  });
});

describe('PaymentResultPage success', () => {
  it('verifies backend truth on entry and shows the order reference', () => {
    const { element, getPaymentStatus } = setup({ orderId: ORDER_ID, enter: toSucceeded });

    expect(getPaymentStatus).toHaveBeenCalledTimes(1);
    expect(getPaymentStatus).toHaveBeenCalledWith(PAYMENT_ID);
    expect(element.querySelector('.payment-result-success')).not.toBeNull();
    expect(element.textContent).toContain(ORDER_ID);
    expect(element.textContent).toContain('Verified status: Succeeded');
  });
});

describe('PaymentResultPage failure', () => {
  it('shows the message with retry and checkout navigation', () => {
    const { element, getPaymentStatus } = setup({
      orderId: ORDER_ID,
      enter: (state) => {
        toPending(state);
        state.markFailed(
          new ApiError({
            status: 0,
            code: 'PaymentDeclined',
            message: 'Your card was declined.',
          }),
        );
      },
    });

    expect(element.querySelector('.payment-result-failure')).not.toBeNull();
    expect(element.textContent).toContain('Your card was declined.');
    expect(links(element)).toContain(`/payment/${ORDER_ID}`);
    expect(links(element)).toContain('/checkout');
    // Terminal failure presents resolved state — no verification read.
    expect(getPaymentStatus).not.toHaveBeenCalled();
  });
});

describe('PaymentResultPage cancelled', () => {
  it('shows cancellation with re-attempt and checkout navigation', () => {
    const { element } = setup({
      orderId: ORDER_ID,
      enter: (state) => {
        toPending(state);
        state.markCancelled();
      },
    });

    expect(element.querySelector('.payment-result-cancelled')).not.toBeNull();
    expect(links(element)).toContain(`/payment/${ORDER_ID}`);
    expect(links(element)).toContain('/checkout');
  });
});

describe('PaymentResultPage pending', () => {
  it('verifies on entry and offers manual status checks', () => {
    const { element, getPaymentStatus } = setup({
      orderId: ORDER_ID,
      enter: toPending,
      statusFlow: () => of(statusEnvelope('Processing')),
    });

    expect(getPaymentStatus).toHaveBeenCalledTimes(1);
    expect(element.querySelector('.payment-result-pending')).not.toBeNull();

    element.querySelector<HTMLButtonElement>('.payment-result-check')?.click();
    expect(getPaymentStatus).toHaveBeenCalledTimes(2);
  });

  it('resolves to success when the backend confirms', () => {
    const { element, getPaymentStatus } = setup({
      orderId: ORDER_ID,
      enter: toPending,
      statusFlow: () => of(statusEnvelope('Succeeded')),
    });

    expect(getPaymentStatus).toHaveBeenCalledTimes(1);
    expect(element.querySelector('.payment-result-success')).not.toBeNull();
  });
});

describe('PaymentResultPage unknown outcome (Sub-Phase 9.9)', () => {
  it('verifies on entry and offers verification without any retry affordance', () => {
    const { element, getPaymentStatus } = setup({
      orderId: ORDER_ID,
      enter: toUnknown,
      statusFlow: () => of(statusEnvelope('Processing')),
    });

    expect(getPaymentStatus).toHaveBeenCalledTimes(1);
    expect(element.querySelector('.payment-result-unknown')).not.toBeNull();
    expect(element.textContent).toContain('do not resubmit');
    // No blind-retry surface: the only payment link is back-to-checkout.
    expect(links(element)).toEqual(['/checkout']);
    expect(element.querySelector('.payment-result-check')).not.toBeNull();
  });

  it('resolves unknown through the manual status check', () => {
    const { element, getPaymentStatus } = setup({
      orderId: ORDER_ID,
      enter: toUnknown,
      statusFlow: () => of(statusEnvelope('Processing')),
    });
    expect(element.querySelector('.payment-result-unknown')).not.toBeNull();

    getPaymentStatus.mockReturnValueOnce(of(statusEnvelope('Succeeded')));
    element.querySelector<HTMLButtonElement>('.payment-result-check')?.click();

    expect(getPaymentStatus).toHaveBeenCalledTimes(2);
  });
});

describe('PaymentResultPage UI pass (Sub-Phase 9.10)', () => {
  const ORDER_BODY = {
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
  };

  function withOrder(state: PaymentState): void {
    toSucceeded(state);
    state.loadOrder(ORDER_ID);
  }

  it('shows the localized success view with the order summary and title', () => {
    const { element } = setup({
      orderId: ORDER_ID,
      orderFlow: () => of({ isSuccess: true, message: 'ok', data: ORDER_BODY }),
      enter: withOrder,
    });

    expect(TestBed.inject(Title).getTitle()).toBe('Payment result | FluxCommerce');
    const text = element.textContent ?? '';
    expect(text).toContain('Payment successful');
    expect(text).toContain('ORD-ABC123DEF456');
    expect(text).toContain('Tee');
    expect(text).toContain('Verified status: Succeeded');
  });

  it('localizes blocked failures instead of leaking technical text', () => {
    const { element } = setup({
      orderId: ORDER_ID,
      enter: (state) => {
        expect(state.beginInitialization(ORDER_ID)).toBe(true);
        state.markFailed(
          new ApiError({
            status: 0,
            code: 'PaymentContractBlocked',
            message: 'Payment initializePayment has no backend HTTP contract.',
          }),
        );
      },
    });

    const text = element.textContent ?? '';
    expect(text).toContain('Payment is currently unavailable');
    expect(text).not.toContain('no backend HTTP contract');
  });
});
