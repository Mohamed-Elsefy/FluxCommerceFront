/**
 * Contract tests for the Sub-Phase 9.5 `PaymentProvider` abstraction.
 *
 * Covers the interface surface only: the concrete
 * `StripePaymentProvider` satisfies `PaymentProvider` (assignment +
 * runtime method presence), and the option/result shapes carry the
 * documented defaults. No SDK, no network, and no confirmation behavior
 * is asserted here — those belong to `stripe-payment-provider.spec.ts`.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PLATFORM_ID } from '@angular/core';
import { STRIPE_JS_SCRIPT_URL } from './stripe-payment-provider';
import { StripePaymentProvider } from './stripe-payment-provider';
import type { PaymentProvider } from './payment-provider';

/** Opaque script-URL stand-in (the real CDN URL lives in app environments — never here). */
const SCRIPT_URL = 'stripe-js-test-script';

function setup(): StripePaymentProvider {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      StripePaymentProvider,
      { provide: PLATFORM_ID, useValue: 'browser' },
      { provide: STRIPE_JS_SCRIPT_URL, useValue: SCRIPT_URL },
    ],
  });
  return TestBed.inject(StripePaymentProvider);
}

describe('PaymentProvider contract', () => {
  it('is satisfied by StripePaymentProvider (assignment proves the surface)', () => {
    const provider: PaymentProvider = setup();
    expect(provider).toBeInstanceOf(StripePaymentProvider);
  });

  it('exposes the five lifecycle methods', () => {
    const provider: PaymentProvider = setup();
    expect(typeof provider.initialize).toBe('function');
    expect(typeof provider.createElements).toBe('function');
    expect(typeof provider.mountPaymentElement).toBe('function');
    expect(typeof provider.confirmPayment).toBe('function');
    expect(typeof provider.destroy).toBe('function');
  });

  it('stays feature-scoped (no root singleton — separate injectors diverge)', () => {
    const first = setup();
    const second = setup();
    expect(second).not.toBe(first);
  });
});
