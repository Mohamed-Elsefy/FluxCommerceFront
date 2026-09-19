/**
 * Page tests for the Sub-Phase 9.6 `PaymentPage` orchestration plus the
 * Sub-Phase 9.9 recovery affordances (retry gating by the recovery
 * table, outstanding-unknown routing).
 *
 * Covers the initialization wiring: entry validation (missing `:orderId`
 * never attempts), the state-driven initialization flow (blocked failure
 * surfaces with retry; success reaches `ready` and prepares the provider
 * exactly once per intent), in-memory secret handling, duplicate
 * prevention, retry, submit gating, server-platform silence, teardown,
 * and outcome routing (terminal, waiting, and outstanding-unknown
 * stages navigate to the result route; genuinely in-flight flows never
 * do). The `PaymentApiService` and the `PaymentProvider` are both
 * stubbed at their seams — this spec owns the page orchestration
 * between them.
 */

import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { EMPTY, NEVER, Observable, of, throwError } from 'rxjs';
import { ApiError } from '@flux/api';
import { PaymentApiService } from '../../data-access/payment-api.service';
import { PAYMENT_PROVIDER } from '../../integrations/payment-provider';
import { STRIPE_PUBLISHABLE_KEY } from '../../integrations/stripe-payment-provider';
import type { PaymentProvider } from '../../integrations/payment-provider';
import { PaymentState } from '../../state/payment-state';
import { PaymentPage } from './payment-page';

const ORDER_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const PAYMENT_ID = '4fa85f64-5717-4562-b3fc-2c963f66afa6';
const CLIENT_SECRET = 'pi_123_secret_abc';
const PUBLISHABLE_KEY = 'pk_test_123';

const BLOCKED = () =>
  throwError(
    () =>
      new ApiError({
        status: 0,
        code: 'PaymentContractBlocked',
        message: 'Payment initializePayment has no backend HTTP contract; no request was sent.',
      }),
  );

const SUCCESS = () =>
  of({
    isSuccess: true,
    message: 'ok',
    data: {
      paymentId: PAYMENT_ID,
      orderId: ORDER_ID,
      clientSecret: CLIENT_SECRET,
      paymentReference: 'pi_123',
      status: 'Pending' as const,
    },
  });

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

const ORDER_SUCCESS = () => of({ isSuccess: true, message: 'ok', data: ORDER_BODY });

interface ProviderStub {
  initialize: Mock;
  createElements: Mock;
  mountPaymentElement: Mock;
  confirmPayment: Mock;
  destroy: Mock;
}

function providerStub(): ProviderStub {
  return {
    initialize: vi.fn(async () => undefined),
    createElements: vi.fn(async () => undefined),
    mountPaymentElement: vi.fn(() => undefined),
    confirmPayment: vi.fn(async () => ({ outcome: 'unknown', message: null })),
    destroy: vi.fn(() => undefined),
  };
}

function setup(options: {
  orderId?: string | null;
  platform?: string;
  apiFlow?: () => Observable<unknown>;
  statusFlow?: () => Observable<unknown>;
  orderFlow?: () => Observable<unknown>;
  provider?: ProviderStub;
}): {
  fixture: ComponentFixture<PaymentPage>;
  element: HTMLElement;
  api: {
    initializePayment: ReturnType<typeof vi.fn>;
    getPaymentStatus: ReturnType<typeof vi.fn>;
    getOrderDetails: ReturnType<typeof vi.fn>;
  };
  provider: ProviderStub;
  navigate: ReturnType<typeof vi.fn>;
  state: PaymentState;
} {
  TestBed.resetTestingModule();
  const api = {
    initializePayment: vi.fn(options.apiFlow ?? BLOCKED),
    getPaymentStatus: vi.fn(options.statusFlow ?? (() => EMPTY)),
    getOrderDetails: vi.fn(options.orderFlow ?? (() => EMPTY)),
  };
  const provider = options.provider ?? providerStub();
  const navigate = vi.fn(async () => true);
  TestBed.configureTestingModule({
    providers: [
      PaymentState,
      { provide: PaymentApiService, useValue: api },
      { provide: PAYMENT_PROVIDER, useValue: provider satisfies PaymentProvider },
      { provide: STRIPE_PUBLISHABLE_KEY, useValue: PUBLISHABLE_KEY },
      { provide: PLATFORM_ID, useValue: options.platform ?? 'browser' },
      { provide: Router, useValue: { navigate } },
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
  const fixture = TestBed.createComponent(PaymentPage);
  fixture.detectChanges();
  return {
    fixture,
    element: fixture.nativeElement as HTMLElement,
    api,
    provider,
    navigate,
    state: TestBed.inject(PaymentState),
  };
}

function retryButton(element: HTMLElement): HTMLButtonElement | null {
  return element.querySelector('payment-error button.retry');
}

/**
 * Flushes floating promise chains (provider setup runs as an
 * un-awaited async task off the state effect — one macrotask turn
 * drains every pending microtask regardless of zone tracking).
 */
async function settleAsync(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

function submitButton(element: HTMLElement): HTMLButtonElement | null {
  return element.querySelector('payment-form .payment-form-submit');
}

describe('PaymentPage entry', () => {
  it('instantiates, shows the order, and composes the shells', () => {
    const { fixture, element } = setup({ orderId: ORDER_ID });
    expect(fixture.componentInstance).toBeTruthy();
    expect(element.textContent).toContain(ORDER_ID);
    expect(element.querySelector('payment-form')).not.toBeNull();
    expect(element.querySelector('payment-status')).not.toBeNull();
    expect(element.querySelector('payment-error')).not.toBeNull();
    expect(element.querySelector('.payment-page-mount')).not.toBeNull();
  });

  it('renders the missing-reference fallback without attempting anything', () => {
    const { element, api, provider } = setup({ orderId: null });
    expect(element.querySelector('.payment-page-missing')).not.toBeNull();
    expect(element.querySelector('payment-form')).toBeNull();
    expect(api.initializePayment).not.toHaveBeenCalled();
    expect(provider.initialize).not.toHaveBeenCalled();
  });

  it('stays silent on the server (shell only, no init, no provider)', () => {
    const { element, api, provider } = setup({ orderId: ORDER_ID, platform: 'server' });
    expect(element.querySelector('payment-form')).not.toBeNull();
    expect(api.initializePayment).not.toHaveBeenCalled();
    expect(provider.initialize).not.toHaveBeenCalled();
  });
});

describe('PaymentPage initialization flow', () => {
  it('initializes on entry and surfaces the blocked failure with retry', () => {
    const { element, api, state } = setup({ orderId: ORDER_ID });
    expect(api.initializePayment).toHaveBeenCalledTimes(1);
    expect(api.initializePayment).toHaveBeenCalledWith({ orderId: ORDER_ID });
    expect(state.lifecycle()).toBe('failed');
    expect(element.textContent).toContain('Payment is currently unavailable');
    expect(element.textContent).not.toContain('no request was sent');
    expect(retryButton(element)).not.toBeNull();
  });

  it('retries initialization through the error shell', () => {
    const { element, api } = setup({ orderId: ORDER_ID });
    retryButton(element)?.click();
    expect(api.initializePayment).toHaveBeenCalledTimes(2);
  });

  it('holds a single active attempt with the loading shell (no retry surface yet)', () => {
    const { element, api, state } = setup({ orderId: ORDER_ID, apiFlow: () => NEVER });
    expect(api.initializePayment).toHaveBeenCalledTimes(1);
    expect(state.lifecycle()).toBe('initializing');
    expect(element.querySelector('payment-loading')).not.toBeNull();
    expect(retryButton(element)).toBeNull();
  });

  it('reaches ready on success with the submit gate released', () => {
    const { element, state } = setup({ orderId: ORDER_ID, apiFlow: SUCCESS });
    expect(state.lifecycle()).toBe('ready');
    expect(submitButton(element)?.disabled).toBe(false);
  });

  it('keeps submit gated until ready', () => {
    const { element } = setup({ orderId: ORDER_ID });
    expect(submitButton(element)?.disabled).toBe(true);
  });
});

describe('PaymentPage submission (Sub-Phase 9.7)', () => {
  it('confirms through the state on submit and locks duplicates', async () => {
    const { element, provider, state } = setup({ orderId: ORDER_ID, apiFlow: SUCCESS });
    expect(state.lifecycle()).toBe('ready');

    submitButton(element)?.click();
    await settleAsync();

    expect(provider.confirmPayment).toHaveBeenCalledTimes(1);
    expect(state.lifecycle()).toBe('processing');
    expect(state.confirmationOutcome()).toBe('unknown');

    // Locked: a second submit never reaches the provider again.
    submitButton(element)?.click();
    await settleAsync();
    expect(provider.confirmPayment).toHaveBeenCalledTimes(1);
  });

  it('maps provider success into the success stage', async () => {
    const succeeding = providerStub();
    succeeding.confirmPayment.mockResolvedValue({ outcome: 'succeeded', message: null });
    const { element, state } = setup({
      orderId: ORDER_ID,
      apiFlow: SUCCESS,
      provider: succeeding,
    });

    submitButton(element)?.click();
    await settleAsync();

    expect(state.lifecycle()).toBe('succeeded');
    expect(state.confirmationOutcome()).toBe('succeeded');
  });
});

describe('PaymentPage outcome routing (Sub-Phase 9.8)', () => {
  it('routes terminal failure to the result route', () => {
    const { navigate } = setup({ orderId: ORDER_ID });
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/payment', ORDER_ID, 'result']);
  });

  it('routes provider success to the result route', async () => {
    const succeeding = providerStub();
    succeeding.confirmPayment.mockResolvedValue({ outcome: 'succeeded', message: null });
    const { element, fixture, navigate } = setup({
      orderId: ORDER_ID,
      apiFlow: SUCCESS,
      provider: succeeding,
    });

    submitButton(element)?.click();
    await settleAsync();
    fixture.detectChanges();
    await settleAsync();

    expect(navigate).toHaveBeenCalledWith(['/payment', ORDER_ID, 'result']);
  });

  it('never routes while the flow is active or unentered', () => {
    const active = setup({ orderId: ORDER_ID, apiFlow: () => NEVER });
    expect(active.navigate).not.toHaveBeenCalled();

    const missing = setup({ orderId: null });
    expect(missing.navigate).not.toHaveBeenCalled();

    const server = setup({ orderId: ORDER_ID, platform: 'server' });
    expect(server.navigate).not.toHaveBeenCalled();
  });

  it('routes outstanding-unknown outcomes to the result route', async () => {
    // Default provider stub resolves `unknown`: the call settled
    // unread, so leaving the live page for verification is safe.
    const { fixture, navigate, state } = setup({ orderId: ORDER_ID, apiFlow: SUCCESS });
    submitButton(fixture.nativeElement as HTMLElement)?.click();
    await settleAsync();
    fixture.detectChanges();
    await settleAsync();

    expect(state.lifecycle()).toBe('processing');
    expect(state.confirmationOutcome()).toBe('unknown');
    expect(navigate).toHaveBeenCalledWith(['/payment', ORDER_ID, 'result']);
  });
});

describe('PaymentPage recovery affordances (Sub-Phase 9.9)', () => {
  it('offers retry on terminal failure with localized copy', () => {
    const { element } = setup({ orderId: ORDER_ID });
    expect(element.textContent).toContain('Payment is currently unavailable');
    expect(element.textContent).not.toContain('no request was sent');
    expect(retryButton(element)).not.toBeNull();
  });

  it('withholds retry for pending check errors (message shown, no dead-end button)', () => {
    const { element, fixture, state } = setup({
      orderId: ORDER_ID,
      apiFlow: SUCCESS,
      statusFlow: () =>
        throwError(
          () => new ApiError({ status: 0, code: 'NetworkError', message: 'Unreachable.' }),
        ),
    });
    expect(state.lifecycle()).toBe('ready');
    expect(state.beginProcessing()).toBe(true);
    expect(state.markPending()).toBe(true);
    state.refreshStatus();
    fixture.detectChanges();

    expect(state.lifecycle()).toBe('pending');
    expect(element.textContent).toContain('A network error occurred');
    expect(element.textContent).not.toContain('Unreachable.');
    expect(retryButton(element)).toBeNull();
  });
});

describe('PaymentPage UI pass (Sub-Phase 9.10)', () => {
  it('renders localized shells with the document title', () => {
    const { element } = setup({ orderId: ORDER_ID, apiFlow: SUCCESS, orderFlow: ORDER_SUCCESS });
    expect(TestBed.inject(Title).getTitle()).toBe('Payment | FluxCommerce');

    const text = element.textContent ?? '';
    expect(text).toContain('Payment details');
    expect(text).toContain('Secure payment form loads here.');
    expect(submitButton(element)?.textContent?.trim()).toBe('Pay');
  });

  it('renders the backend order summary without secrets or technical text', () => {
    const { element, api } = setup({
      orderId: ORDER_ID,
      apiFlow: SUCCESS,
      orderFlow: ORDER_SUCCESS,
    });
    expect(api.getOrderDetails).toHaveBeenCalledTimes(1);
    expect(api.getOrderDetails).toHaveBeenCalledWith(ORDER_ID);

    const summary = element.querySelector('payment-order-summary');
    expect(summary).not.toBeNull();
    const text = element.textContent ?? '';
    expect(text).toContain('Order summary');
    expect(text).toContain('ORD-ABC123DEF456');
    expect(text).toContain('Tee');
    expect(text).not.toContain(CLIENT_SECRET);
    expect(text).not.toContain('no request was sent');
    expect(text).not.toContain('pi_');
  });

  it('hides the summary when the order read fails without failing payment', () => {
    const { element, state } = setup({
      orderId: ORDER_ID,
      apiFlow: SUCCESS,
      orderFlow: () => throwError(() => new Error('down')),
    });
    expect(state.lifecycle()).toBe('ready');
    expect(element.querySelector('payment-order-summary')).not.toBeNull();
    expect(element.textContent).not.toContain('ORD-ABC123DEF456');
  });
});

describe('PaymentPage provider setup', () => {
  it('prepares the provider once per intent after ready', async () => {
    const { fixture, provider, state } = setup({ orderId: ORDER_ID, apiFlow: SUCCESS });
    await fixture.whenStable();
    await settleAsync();

    expect(state.lifecycle()).toBe('ready');
    expect(provider.initialize).toHaveBeenCalledTimes(1);
    expect(provider.initialize).toHaveBeenCalledWith({ publishableKey: PUBLISHABLE_KEY });
    expect(provider.createElements).toHaveBeenCalledTimes(1);
    expect(provider.createElements).toHaveBeenCalledWith(CLIENT_SECRET);
    expect(provider.mountPaymentElement).toHaveBeenCalledTimes(1);
  });

  it('keeps the secret in memory only', async () => {
    globalThis.localStorage.clear();
    globalThis.sessionStorage.clear();
    const { fixture, state } = setup({ orderId: ORDER_ID, apiFlow: SUCCESS });
    await fixture.whenStable();
    await settleAsync();

    expect(state.clientSecret()).toBe(CLIENT_SECRET);
    expect(globalThis.localStorage.length).toBe(0);
    expect(globalThis.sessionStorage.length).toBe(0);
    expect(globalThis.location.href).not.toContain(CLIENT_SECRET);
  });

  it('records provider setup failures on the state', async () => {
    const failing = providerStub();
    failing.createElements.mockRejectedValue(new Error('elements down'));
    const { fixture, state } = setup({
      orderId: ORDER_ID,
      apiFlow: SUCCESS,
      provider: failing,
    });
    await fixture.whenStable();
    await settleAsync();

    expect(state.lifecycle()).toBe('failed');
    expect(state.statusError()?.message).toBe('Payment setup failed.');
  });

  it('tears down the provider on destroy', () => {
    const { fixture, provider } = setup({ orderId: ORDER_ID, apiFlow: SUCCESS });
    fixture.destroy();
    expect(provider.destroy).toHaveBeenCalledTimes(1);
  });
});
