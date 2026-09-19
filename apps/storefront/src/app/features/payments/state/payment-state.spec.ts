/**
 * State tests for the Sub-Phase 9.4 `PaymentState` (plus the
 * `canTransitionPaymentLifecycle` guard).
 *
 * Covers the lifecycle model only: the initial shape, every §9.4 valid
 * edge, rejection of invalid transitions (state untouched on rejection),
 * context tracking (order/payment ids, runtime secret, backend status,
 * error), the `Initialized ≠ Succeeded` rule, re-entry and reset
 * semantics, and the derived selectors. No API execution, no provider,
 * and no page orchestration is asserted here — those arrive in
 * Sub-Phases 9.5+.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY, NEVER, of, throwError, type Observable } from 'rxjs';
import { ApiError, type ApiResponseWithData } from '@flux/api';
import type { PaymentInitializationResult } from '@flux/models';
import type { ProviderConfirmationResult } from '../integrations/payment-provider';
import { PaymentApiService } from '../data-access/payment-api.service';
import { PAYMENT_PROVIDER } from '../integrations/payment-provider';
import {
  canTransitionPaymentLifecycle,
  PAYMENT_DECLINED_CODE,
  PAYMENT_LIFECYCLE_TRANSITIONS,
  PaymentState,
  type PaymentLifecycle,
} from './payment-state';

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const PAYMENT_ID = '22222222-2222-4222-8222-222222222222';
const CLIENT_SECRET = 'pi_123_secret_abc';

function setup(): PaymentState {
  // Fresh module per setup — several tests drive multiple isolated
  // instances (one per stage) within a single case. The service and the
  // provider are stubbed inert (these tests never execute them — see the
  // `initializePayment` / `confirmPayment` blocks for execution
  // coverage).
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      PaymentState,
      { provide: PaymentApiService, useValue: { initializePayment: () => EMPTY } },
      { provide: PAYMENT_PROVIDER, useValue: { confirmPayment: () => EMPTY } },
    ],
  });
  return TestBed.inject(PaymentState);
}

function failure(): ApiError {
  return new ApiError({ status: 409, code: 'Order.CancelConflict', message: 'Conflict.' });
}

/**
 * Flushes floating promise chains (provider confirmation resolves off
 * the action call — one macrotask turn drains every pending microtask
 * regardless of zone tracking).
 */
async function settleAsync(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

function toReady(state: PaymentState): void {
  expect(state.beginInitialization(ORDER_ID)).toBe(true);
  expect(
    state.markReady({
      paymentId: PAYMENT_ID,
      clientSecret: CLIENT_SECRET,
      paymentStatus: 'Pending',
    }),
  ).toBe(true);
}

describe('PaymentState initial shape', () => {
  it('starts idle with empty context, facts, and error', () => {
    const state = setup();
    expect(state.lifecycle()).toBe('idle');
    expect(state.context()).toEqual({
      orderId: null,
      paymentId: null,
      clientSecret: null,
      paymentStatus: null,
      statusError: null,
    });
    expect(state.isProcessing()).toBe(false);
    expect(state.isTerminal()).toBe(false);
  });
});

describe('canTransitionPaymentLifecycle', () => {
  it('declares the §9.4 transition table', () => {
    expect(PAYMENT_LIFECYCLE_TRANSITIONS).toEqual({
      idle: ['initializing'],
      initializing: ['ready', 'failed'],
      ready: ['processing', 'failed'],
      processing: ['succeeded', 'failed', 'pending', 'cancelled'],
      succeeded: [],
      failed: ['initializing'],
      pending: ['succeeded', 'failed'],
      cancelled: ['initializing'],
    });
  });

  it('accepts every §9.4 valid edge', () => {
    const edges: Array<[PaymentLifecycle, PaymentLifecycle]> = [
      ['idle', 'initializing'],
      ['initializing', 'ready'],
      ['initializing', 'failed'],
      ['ready', 'processing'],
      ['ready', 'failed'],
      ['processing', 'succeeded'],
      ['processing', 'failed'],
      ['processing', 'pending'],
      ['processing', 'cancelled'],
      ['pending', 'succeeded'],
      ['pending', 'failed'],
      ['failed', 'initializing'],
      ['cancelled', 'initializing'],
    ];
    for (const [from, to] of edges) {
      expect(canTransitionPaymentLifecycle(from, to)).toBe(true);
    }
  });

  it('rejects skips, reversals, and terminal exits', () => {
    const rejected: Array<[PaymentLifecycle, PaymentLifecycle]> = [
      ['idle', 'processing'],
      ['idle', 'ready'],
      ['idle', 'succeeded'],
      ['initializing', 'processing'],
      ['initializing', 'succeeded'],
      ['ready', 'succeeded'],
      ['ready', 'initializing'],
      ['processing', 'ready'],
      ['processing', 'initializing'],
      ['succeeded', 'processing'],
      ['succeeded', 'failed'],
      ['pending', 'processing'],
      ['pending', 'cancelled'],
      ['failed', 'processing'],
      ['cancelled', 'processing'],
    ];
    for (const [from, to] of rejected) {
      expect(canTransitionPaymentLifecycle(from, to)).toBe(false);
    }
  });

  it('fails closed on unknown stages and missing input', () => {
    expect(canTransitionPaymentLifecycle('Refunding', 'failed')).toBe(false);
    expect(canTransitionPaymentLifecycle('idle', 'Refunding')).toBe(false);
    expect(canTransitionPaymentLifecycle(null, 'failed')).toBe(false);
    expect(canTransitionPaymentLifecycle('idle', undefined)).toBe(false);
  });
});

describe('PaymentState beginInitialization', () => {
  it('enters initializing with the order id and cleared context', () => {
    const state = setup();
    expect(state.beginInitialization(ORDER_ID)).toBe(true);
    expect(state.lifecycle()).toBe('initializing');
    expect(state.orderId()).toBe(ORDER_ID);
    expect(state.paymentId()).toBeNull();
    expect(state.clientSecret()).toBeNull();
    expect(state.paymentStatus()).toBeNull();
    expect(state.statusError()).toBeNull();
  });

  it('rejects re-entry while initializing, ready, processing, pending, or succeeded', () => {
    const initializing = setup();
    expect(initializing.beginInitialization(ORDER_ID)).toBe(true);
    expect(initializing.beginInitialization('other')).toBe(false);
    expect(initializing.orderId()).toBe(ORDER_ID);

    const ready = setup();
    toReady(ready);
    expect(ready.beginInitialization('other')).toBe(false);
    expect(ready.orderId()).toBe(ORDER_ID);

    const processing = setup();
    toReady(processing);
    expect(processing.beginProcessing()).toBe(true);
    expect(processing.beginInitialization('other')).toBe(false);

    const pending = setup();
    toReady(pending);
    pending.beginProcessing();
    pending.markPending();
    expect(pending.beginInitialization('other')).toBe(false);

    const succeeded = setup();
    toReady(succeeded);
    succeeded.beginProcessing();
    succeeded.markSucceeded('Succeeded');
    expect(succeeded.beginInitialization('other')).toBe(false);
    expect(succeeded.orderId()).toBe(ORDER_ID);
  });
});

describe('PaymentState markReady (Initialized ≠ Succeeded)', () => {
  it('records intent context and reaches ready — never succeeded', () => {
    const state = setup();
    state.beginInitialization(ORDER_ID);
    expect(
      state.markReady({
        paymentId: PAYMENT_ID,
        clientSecret: CLIENT_SECRET,
        paymentStatus: 'Pending',
      }),
    ).toBe(true);

    expect(state.lifecycle()).toBe('ready');
    expect(state.paymentId()).toBe(PAYMENT_ID);
    expect(state.clientSecret()).toBe(CLIENT_SECRET);
    expect(state.paymentStatus()).toBe('Pending');
    expect(state.isProcessing()).toBe(false);
    expect(state.isTerminal()).toBe(false);
  });

  it('rejects readiness outside initializing (ready is not reachable by skip)', () => {
    const state = setup();
    const context = {
      paymentId: PAYMENT_ID,
      clientSecret: CLIENT_SECRET,
      paymentStatus: 'Pending' as const,
    };
    expect(state.markReady(context)).toBe(false);
    expect(state.lifecycle()).toBe('idle');
    expect(state.paymentId()).toBeNull();
    expect(state.clientSecret()).toBeNull();

    toReady(state);
    expect(state.beginProcessing()).toBe(true);
    expect(state.markReady(context)).toBe(false);
    expect(state.lifecycle()).toBe('processing');
  });
});

describe('PaymentState beginProcessing', () => {
  it('moves ready to processing', () => {
    const state = setup();
    toReady(state);
    expect(state.beginProcessing()).toBe(true);
    expect(state.lifecycle()).toBe('processing');
    expect(state.isProcessing()).toBe(true);
    expect(state.isTerminal()).toBe(false);
  });

  it('rejects direct idle/initializing to processing transitions', () => {
    const state = setup();
    expect(state.beginProcessing()).toBe(false);
    expect(state.lifecycle()).toBe('idle');

    state.beginInitialization(ORDER_ID);
    expect(state.beginProcessing()).toBe(false);
    expect(state.lifecycle()).toBe('initializing');
  });

  it('locks duplicate submission while processing', () => {
    const state = setup();
    toReady(state);
    expect(state.beginProcessing()).toBe(true);
    expect(state.beginProcessing()).toBe(false);
    expect(state.lifecycle()).toBe('processing');
  });
});

describe('PaymentState markSucceeded', () => {
  it('resolves processing and pending with the authoritative status', () => {
    const processing = setup();
    toReady(processing);
    processing.beginProcessing();
    expect(processing.markSucceeded('Succeeded')).toBe(true);
    expect(processing.lifecycle()).toBe('succeeded');
    expect(processing.paymentStatus()).toBe('Succeeded');
    expect(processing.isProcessing()).toBe(false);
    expect(processing.isTerminal()).toBe(true);

    const pending = setup();
    toReady(pending);
    pending.beginProcessing();
    pending.markPending();
    expect(pending.markSucceeded('Succeeded')).toBe(true);
    expect(pending.lifecycle()).toBe('succeeded');
  });

  it('rejects success from ready, initializing, idle, failed, and cancelled', () => {
    const idle = setup();
    expect(idle.markSucceeded('Succeeded')).toBe(false);
    expect(idle.lifecycle()).toBe('idle');

    const initializing = setup();
    initializing.beginInitialization(ORDER_ID);
    expect(initializing.markSucceeded('Succeeded')).toBe(false);
    expect(initializing.lifecycle()).toBe('initializing');

    const ready = setup();
    toReady(ready);
    expect(ready.markSucceeded('Succeeded')).toBe(false);
    expect(ready.lifecycle()).toBe('ready');
    expect(ready.isTerminal()).toBe(false);

    const failed = setup();
    failed.beginInitialization(ORDER_ID);
    failed.markFailed(failure());
    expect(failed.markSucceeded('Succeeded')).toBe(false);

    const cancelled = setup();
    toReady(cancelled);
    cancelled.beginProcessing();
    cancelled.markCancelled();
    expect(cancelled.markSucceeded('Succeeded')).toBe(false);
  });
});

describe('PaymentState markFailed', () => {
  it('records failures from initializing, ready, processing, and pending', () => {
    const stages: Array<(state: PaymentState) => void> = [
      (state) => {
        state.beginInitialization(ORDER_ID);
      },
      (state) => toReady(state),
      (state) => {
        toReady(state);
        state.beginProcessing();
      },
      (state) => {
        toReady(state);
        state.beginProcessing();
        state.markPending();
      },
    ];
    for (const enter of stages) {
      const state = setup();
      enter(state);
      expect(state.markFailed(failure())).toBe(true);
      expect(state.lifecycle()).toBe('failed');
      expect(state.statusError()).toBeInstanceOf(ApiError);
      expect(state.isTerminal()).toBe(true);
      expect(state.isProcessing()).toBe(false);
    }
  });

  it('preserves intent context for diagnosis and safe retry', () => {
    const state = setup();
    toReady(state);
    state.beginProcessing();
    state.markFailed(failure());
    expect(state.orderId()).toBe(ORDER_ID);
    expect(state.paymentId()).toBe(PAYMENT_ID);
  });

  it('rejects failure from idle, succeeded, failed, and cancelled', () => {
    const idle = setup();
    expect(idle.markFailed(failure())).toBe(false);
    expect(idle.lifecycle()).toBe('idle');
    expect(idle.statusError()).toBeNull();

    const succeeded = setup();
    toReady(succeeded);
    succeeded.beginProcessing();
    succeeded.markSucceeded('Succeeded');
    expect(succeeded.markFailed(failure())).toBe(false);
    expect(succeeded.statusError()).toBeNull();

    const failed = setup();
    failed.beginInitialization(ORDER_ID);
    failed.markFailed(failure());
    expect(failed.markFailed(failure())).toBe(false);

    const cancelled = setup();
    toReady(cancelled);
    cancelled.beginProcessing();
    cancelled.markCancelled();
    expect(cancelled.markFailed(failure())).toBe(false);
    expect(cancelled.statusError()).toBeNull();
  });
});

describe('PaymentState markPending and markCancelled', () => {
  it('holds processing outcomes as non-terminal pending', () => {
    const state = setup();
    toReady(state);
    state.beginProcessing();
    expect(state.markPending()).toBe(true);
    expect(state.lifecycle()).toBe('pending');
    expect(state.isTerminal()).toBe(false);
    expect(state.isProcessing()).toBe(false);
  });

  it('ends processing as terminal cancelled', () => {
    const state = setup();
    toReady(state);
    state.beginProcessing();
    expect(state.markCancelled()).toBe(true);
    expect(state.lifecycle()).toBe('cancelled');
    expect(state.isTerminal()).toBe(true);
  });

  it('rejects pending and cancelled outside processing', () => {
    const state = setup();
    expect(state.markPending()).toBe(false);
    expect(state.markCancelled()).toBe(false);

    toReady(state);
    expect(state.markPending()).toBe(false);
    expect(state.markCancelled()).toBe(false);
    expect(state.lifecycle()).toBe('ready');
  });
});

describe('PaymentState re-entry, recovery, and reset', () => {
  it('re-enters initialization from failed with rotated context', () => {
    const state = setup();
    toReady(state);
    state.beginProcessing();
    state.markFailed(failure());

    expect(state.beginInitialization('new-order')).toBe(true);
    expect(state.lifecycle()).toBe('initializing');
    expect(state.orderId()).toBe('new-order');
    expect(state.paymentId()).toBeNull();
    expect(state.clientSecret()).toBeNull();
    expect(state.paymentStatus()).toBeNull();
    expect(state.statusError()).toBeNull();
  });

  it('re-enters initialization from cancelled', () => {
    const state = setup();
    toReady(state);
    state.beginProcessing();
    state.markCancelled();

    expect(state.beginInitialization(ORDER_ID)).toBe(true);
    expect(state.lifecycle()).toBe('initializing');
  });

  it('clears the error without moving the lifecycle', () => {
    const state = setup();
    state.beginInitialization(ORDER_ID);
    state.markFailed(failure());
    state.clearError();
    expect(state.statusError()).toBeNull();
    expect(state.lifecycle()).toBe('failed');
  });

  it('resets to the initial shape from a terminal stage', () => {
    const state = setup();
    toReady(state);
    state.beginProcessing();
    state.markSucceeded('Succeeded');
    state.reset();

    expect(state.lifecycle()).toBe('idle');
    expect(state.context()).toEqual({
      orderId: null,
      paymentId: null,
      clientSecret: null,
      paymentStatus: null,
      statusError: null,
    });
    expect(state.isTerminal()).toBe(false);
  });
});

describe('PaymentState initializePayment (Sub-Phase 9.6 execution)', () => {
  const INIT_RESULT: PaymentInitializationResult = {
    paymentId: PAYMENT_ID,
    orderId: ORDER_ID,
    clientSecret: CLIENT_SECRET,
    paymentReference: 'pi_123',
    status: 'Pending',
  };

  function setupWithApi(flow: () => Observable<ApiResponseWithData<PaymentInitializationResult>>): {
    state: PaymentState;
    initializePayment: ReturnType<typeof vi.fn>;
  } {
    TestBed.resetTestingModule();
    const initializePayment = vi.fn(flow);
    TestBed.configureTestingModule({
      providers: [
        PaymentState,
        { provide: PaymentApiService, useValue: { initializePayment } },
        { provide: PAYMENT_PROVIDER, useValue: { confirmPayment: () => EMPTY } },
      ],
    });
    return { state: TestBed.inject(PaymentState), initializePayment };
  }

  const success = () => of({ isSuccess: true, message: 'ok', data: INIT_RESULT });
  const blocked = () =>
    throwError(
      () =>
        new ApiError({
          status: 0,
          code: 'PaymentContractBlocked',
          message: 'Payment initializePayment has no backend HTTP contract; no request was sent.',
        }),
    );

  it('initializes through the service and records intent context in memory', () => {
    const { state, initializePayment } = setupWithApi(success);
    state.initializePayment(ORDER_ID);

    expect(initializePayment).toHaveBeenCalledTimes(1);
    expect(initializePayment).toHaveBeenCalledWith({ orderId: ORDER_ID });
    expect(state.lifecycle()).toBe('ready');
    expect(state.paymentId()).toBe(PAYMENT_ID);
    expect(state.clientSecret()).toBe(CLIENT_SECRET);
    expect(state.paymentStatus()).toBe('Pending');
    expect(state.statusError()).toBeNull();
  });

  it('keeps the secret in memory only (no persistent sinks, no URL echo)', () => {
    // Isolate our writes: the shared runner environment may carry
    // entries from other specs.
    globalThis.localStorage.clear();
    globalThis.sessionStorage.clear();
    const { state } = setupWithApi(success);
    state.initializePayment(ORDER_ID);

    expect(state.clientSecret()).toBe(CLIENT_SECRET);
    expect(globalThis.localStorage.length).toBe(0);
    expect(globalThis.sessionStorage.length).toBe(0);
    expect(globalThis.location.href).not.toContain(CLIENT_SECRET);
  });

  it('records the contract-blocked failure without losing the order', () => {
    const { state, initializePayment } = setupWithApi(blocked);
    state.initializePayment(ORDER_ID);

    expect(initializePayment).toHaveBeenCalledTimes(1);
    expect(state.lifecycle()).toBe('failed');
    expect(state.orderId()).toBe(ORDER_ID);
    expect(state.statusError()).toBeInstanceOf(ApiError);
    expect(state.statusError()?.code).toBe('PaymentContractBlocked');
  });

  it('treats a dataless envelope as a contract violation', () => {
    const { state } = setupWithApi(() => of({ isSuccess: true, message: 'ok', data: null }));
    state.initializePayment(ORDER_ID);

    expect(state.lifecycle()).toBe('failed');
    expect(state.statusError()?.code).toBe('UnknownError');
  });

  it('normalizes non-ApiError throwables instead of re-throwing', () => {
    const { state } = setupWithApi(() => throwError(() => new Error('boom')));
    expect(() => state.initializePayment(ORDER_ID)).not.toThrow();
    expect(state.lifecycle()).toBe('failed');
    expect(state.statusError()).toBeInstanceOf(ApiError);
  });

  it('drops duplicate attempts while a request is active (no second call)', () => {
    const { state, initializePayment } = setupWithApi(() => NEVER);
    state.initializePayment(ORDER_ID);
    expect(state.lifecycle()).toBe('initializing');

    state.initializePayment(ORDER_ID);
    expect(initializePayment).toHaveBeenCalledTimes(1);
    expect(state.lifecycle()).toBe('initializing');
  });

  it('retries from failed with a fresh attempt', () => {
    const { state, initializePayment } = setupWithApi(blocked);
    state.initializePayment(ORDER_ID);
    expect(state.lifecycle()).toBe('failed');

    state.initializePayment(ORDER_ID);
    expect(initializePayment).toHaveBeenCalledTimes(2);
    expect(state.lifecycle()).toBe('failed');
  });
});

describe('PaymentState confirmPayment (Sub-Phase 9.7 execution)', () => {
  const READY_RESULT = {
    paymentId: PAYMENT_ID,
    orderId: ORDER_ID,
    clientSecret: CLIENT_SECRET,
    paymentReference: 'pi_123',
    status: 'Pending' as const,
  };

  function setupReady(
    confirmFlow: () => Promise<ProviderConfirmationResult> = async () => ({
      outcome: 'succeeded',
      message: null,
    }),
  ): {
    state: PaymentState;
    confirmPayment: ReturnType<typeof vi.fn>;
  } {
    TestBed.resetTestingModule();
    const confirmPayment = vi.fn(confirmFlow);
    TestBed.configureTestingModule({
      providers: [
        PaymentState,
        {
          provide: PaymentApiService,
          useValue: {
            initializePayment: () => of({ isSuccess: true, message: 'ok', data: READY_RESULT }),
          },
        },
        { provide: PAYMENT_PROVIDER, useValue: { confirmPayment } },
      ],
    });
    const state = TestBed.inject(PaymentState);
    state.initializePayment(ORDER_ID);
    expect(state.lifecycle()).toBe('ready');
    return { state, confirmPayment };
  }

  it('confirms through the provider and maps immediate success', async () => {
    const { state, confirmPayment } = setupReady();
    state.confirmPayment();
    await settleAsync();

    expect(confirmPayment).toHaveBeenCalledTimes(1);
    expect(confirmPayment).toHaveBeenCalledWith({});
    expect(state.lifecycle()).toBe('succeeded');
    expect(state.paymentStatus()).toBe('Succeeded');
    expect(state.confirmationOutcome()).toBe('succeeded');
    expect(state.isTerminal()).toBe(true);
  });

  it('forwards the return URL for redirect-based methods', async () => {
    const { state, confirmPayment } = setupReady();
    state.confirmPayment({ returnUrl: 'test-return-url' });
    await settleAsync();

    expect(confirmPayment).toHaveBeenCalledWith({ returnUrl: 'test-return-url' });
    expect(state.lifecycle()).toBe('succeeded');
  });

  it('maps declines to failed with the declined code and message', async () => {
    const { state } = setupReady(async () => ({
      outcome: 'failed',
      message: 'Your card was declined.',
    }));
    state.confirmPayment();
    await settleAsync();

    expect(state.lifecycle()).toBe('failed');
    expect(state.statusError()).toBeInstanceOf(ApiError);
    expect(state.statusError()?.code).toBe(PAYMENT_DECLINED_CODE);
    expect(state.statusError()?.message).toBe('Your card was declined.');
    expect(state.confirmationOutcome()).toBe('failed');
  });

  it('falls back to a diagnostic when the decline carries no message', async () => {
    const { state } = setupReady(async () => ({ outcome: 'failed', message: null }));
    state.confirmPayment();
    await settleAsync();

    expect(state.lifecycle()).toBe('failed');
    expect(state.statusError()?.code).toBe(PAYMENT_DECLINED_CODE);
    expect(state.statusError()?.message).toBe('Payment was declined.');
  });

  it('maps cancellation to terminal cancelled', async () => {
    const { state } = setupReady(async () => ({ outcome: 'cancelled', message: null }));
    state.confirmPayment();
    await settleAsync();

    expect(state.lifecycle()).toBe('cancelled');
    expect(state.confirmationOutcome()).toBe('cancelled');
    expect(state.isTerminal()).toBe(true);
  });

  it('maps action-required and pending to non-terminal pending', async () => {
    const action = setupReady(async () => ({ outcome: 'requiresAction', message: null }));
    action.state.confirmPayment();
    await settleAsync();
    expect(action.state.lifecycle()).toBe('pending');
    expect(action.state.confirmationOutcome()).toBe('requiresAction');
    expect(action.state.isTerminal()).toBe(false);

    const pending = setupReady(async () => ({ outcome: 'pending', message: null }));
    pending.state.confirmPayment();
    await settleAsync();
    expect(pending.state.lifecycle()).toBe('pending');
    expect(pending.state.confirmationOutcome()).toBe('pending');
  });

  it('holds processing on unknown outcomes with the submit lock on', async () => {
    const { state, confirmPayment } = setupReady(async () => ({
      outcome: 'unknown',
      message: null,
    }));
    state.confirmPayment();
    await settleAsync();

    expect(confirmPayment).toHaveBeenCalledTimes(1);
    expect(state.lifecycle()).toBe('processing');
    expect(state.confirmationOutcome()).toBe('unknown');
    expect(state.isTerminal()).toBe(false);

    // The lock holds: no second provider contact while outstanding.
    state.confirmPayment();
    expect(confirmPayment).toHaveBeenCalledTimes(1);
  });

  it('normalizes provider rejections to failed without re-throwing', async () => {
    const { state } = setupReady(async () => {
      throw new Error('sdk down');
    });
    expect(() => state.confirmPayment()).not.toThrow();
    await settleAsync();

    expect(state.lifecycle()).toBe('failed');
    expect(state.statusError()).toBeInstanceOf(ApiError);
  });

  it('locks duplicate submissions while confirmation is outstanding', async () => {
    const { state, confirmPayment } = setupReady(() => new Promise(() => undefined));
    state.confirmPayment();
    state.confirmPayment();
    await settleAsync();

    expect(confirmPayment).toHaveBeenCalledTimes(1);
    expect(state.lifecycle()).toBe('processing');
    expect(state.isProcessing()).toBe(true);
  });

  it('rejects confirmation outside ready without contacting the provider', async () => {
    const { state, confirmPayment } = setupReady();
    state.reset();
    state.confirmPayment();
    await settleAsync();
    expect(confirmPayment).not.toHaveBeenCalled();
    expect(state.lifecycle()).toBe('idle');

    state.initializePayment(ORDER_ID);
    expect(state.lifecycle()).toBe('ready');
  });
});
