/**
 * Page tests for the Sub-Phase 9.6 `PaymentPage` orchestration.
 *
 * Covers the initialization wiring only: entry validation (missing
 * `:orderId` never attempts), the state-driven initialization flow
 * (blocked failure surfaces with retry; success reaches `ready` and
 * prepares the provider exactly once per intent), in-memory secret
 * handling, duplicate prevention, retry, submit gating, server-platform
 * silence, and teardown. The `PaymentApiService` (blocked short-circuit
 * vs. success envelope) and the `PaymentProvider` are both stubbed at
 * their seams — this spec owns the page orchestration between them.
 * Confirmation actions arrive in Sub-Phase 9.7.
 */

import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NEVER, Observable, of, throwError } from 'rxjs';
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
  provider?: ProviderStub;
}): {
  fixture: ComponentFixture<PaymentPage>;
  element: HTMLElement;
  api: { initializePayment: ReturnType<typeof vi.fn> };
  provider: ProviderStub;
  state: PaymentState;
} {
  TestBed.resetTestingModule();
  const api = { initializePayment: vi.fn(options.apiFlow ?? BLOCKED) };
  const provider = options.provider ?? providerStub();
  TestBed.configureTestingModule({
    providers: [
      PaymentState,
      { provide: PaymentApiService, useValue: api },
      { provide: PAYMENT_PROVIDER, useValue: provider satisfies PaymentProvider },
      { provide: STRIPE_PUBLISHABLE_KEY, useValue: PUBLISHABLE_KEY },
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
  const fixture = TestBed.createComponent(PaymentPage);
  fixture.detectChanges();
  return {
    fixture,
    element: fixture.nativeElement as HTMLElement,
    api,
    provider,
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
    expect(element.textContent).toContain('no request was sent');
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
