/**
 * Page tests for the Sub-Phase 9.8 `PaymentResultPage` outcome hub.
 *
 * Covers result presentation only: per-outcome blocks (success with
 * order reference, failure/cancelled with navigation options, pending
 * with manual verification, neutral fallback), backend verification on
 * entry for success/pending claims, and server-platform silence. The
 * `PaymentApiService` is stubbed at its seam — this spec owns the page
 * orchestration around state and routing. Polling and recovery
 * algorithms arrive in Sub-Phase 9.9.
 */

import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
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
  enter?: (state: PaymentState) => void;
}): {
  fixture: ComponentFixture<PaymentResultPage>;
  element: HTMLElement;
  state: PaymentState;
  getPaymentStatus: ReturnType<typeof vi.fn>;
} {
  TestBed.resetTestingModule();
  const getPaymentStatus = vi.fn(options.statusFlow ?? (() => of(statusEnvelope('Succeeded'))));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      PaymentState,
      {
        provide: PaymentApiService,
        useValue: { initializePayment: () => EMPTY, getPaymentStatus },
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
