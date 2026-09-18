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
import { describe, expect, it } from 'vitest';
import { ApiError } from '@flux/api';
import {
  canTransitionPaymentLifecycle,
  PAYMENT_LIFECYCLE_TRANSITIONS,
  PaymentState,
  type PaymentLifecycle,
} from './payment-state';

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const PAYMENT_ID = '22222222-2222-4222-8222-222222222222';
const CLIENT_SECRET = 'pi_123_secret_abc';

function setup(): PaymentState {
  // Fresh module per setup — several tests drive multiple isolated
  // instances (one per stage) within a single case.
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [PaymentState] });
  return TestBed.inject(PaymentState);
}

function failure(): ApiError {
  return new ApiError({ status: 409, code: 'Order.CancelConflict', message: 'Conflict.' });
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
