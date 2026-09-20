/**
 * Payment provider abstraction for Sub-Phase 9.5 — Stripe.js / Elements
 * Integration Boundary.
 *
 * Scope: `docs/phases/PHASE_9_PAYMENTS.md` §9.5 (provider boundary only
 * — no Stripe SDK, no Elements mounting, no confirmation execution).
 *
 * Source of truth: `docs/phases/PHASE_9_PAYMENTS.md` §9.5 (lifecycle
 * contract), `docs/frontend-contract/PAYMENT_INTEGRATION_NOTES.md` §4
 * (the future Stripe.js flow), and the Sub-Phase 9.1 audit module
 * (`@flux/models` `payment-contract`:
 * `ProviderConfirmationOutcome`).
 *
 * Boundary rule (the §9.5 architecture — target flow):
 *
 * ```text
 * Payment Component (9.2 shells — orchestration in 9.6+)
 *        ↓ PaymentState (9.4 — feature-owned local Signals)
 *        ↓ PaymentProvider (this file — the ONLY surface features touch)
 *        ↓ StripePaymentProvider (`./stripe-payment-provider`)
 *        ↓ Stripe.js / Elements
 * ```
 *
 * Feature components and feature state must interact ONLY with this
 * interface — never with Stripe SDK types, never with Elements handles.
 * The interface is provider-neutral (a second provider re-implements
 * these five methods without touching any consumer), promise-based
 * (provider work is inherently async), and SSR-agnostic (implementations
 * own the browser guards — see `StripePaymentProvider`).
 *
 * Sensitive-data rule: the client secret crosses this boundary as an
 * opaque runtime value (in-memory only, never persisted or logged by
 * either side). Raw card data never crosses it at all — Elements owns
 * card input inside the implementation. Outcomes carry a displayable
 * message at most, never secrets.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 9.5 impl — no Stripe SDK import, no loader, no Elements handles
 *   (see `./stripe-payment-provider`).
 * - 9.6 — no initialization wiring, no Elements mounting calls, no
 *   page orchestration.
 * - 9.7 — no confirmation user actions.
 */

import type { ProviderConfirmationOutcome } from '@flux/models';
import { InjectionToken } from '@angular/core';

/**
 * Provider setup: the publishable key for the active app environment
 * (the ONLY Stripe key the SPA may hold — §9.1 `SPA_STRIPE_KEY_SLOT`;
 * supplied per call by the 9.6 wiring from app environments, never via
 * API, never the secret key).
 */
export interface ProviderConfig {
  readonly publishableKey: string;
}

/**
 * Provider confirmation options. Card details are deliberately absent —
 * Elements collects them inside the implementation. Only provider-level
 * redirect behavior is configurable here.
 */
export interface ConfirmPaymentOptions {
  /**
   * Return URL for redirect-based methods (3-D Secure). Omitted for
   * in-place confirmation.
   */
  readonly returnUrl?: string;
}

/**
 * Provider confirmation result: the §9.1 outcome bucket plus an optional
 * displayable message (decline text — never secrets, never raw payloads).
 * `unknown` means sent-but-unread (e.g. transport loss after submit) and
 * must resolve via the §9.3 status read first — never blind-retry (9.9).
 */
export interface ProviderConfirmationResult {
  readonly outcome: ProviderConfirmationOutcome;
  readonly message: string | null;
}

/**
 * Abstraction token — the ONLY injection point feature code uses for
 * provider access. Consumers inject `PAYMENT_PROVIDER` (typed as
 * `PaymentProvider`) and never the concrete adapter. The payments route
 * binds it (currently to `StripePaymentProvider` — see
 * `./stripe-payment-provider`, which also hosts the Stripe-specific
 * `STRIPE_*` tokens that must never leak into consumers).
 */
export const PAYMENT_PROVIDER = new InjectionToken<PaymentProvider>('PAYMENT_PROVIDER');

/**
 * Payment provider lifecycle contract. All implementations are
 * promise-based and reject (never throw synchronously) with technical
 * English diagnostics on misuse — lifecycle violations, missing setup,
 * or server-platform calls.
 */
export interface PaymentProvider {
  /**
   * Loads the provider SDK (browser-only; silent no-op on the server)
   * and readies it with the environment publishable key. Safe to call
   * again (re-entrant — re-establishes the SDK handle).
   */
  initialize(config: ProviderConfig): Promise<void>;

  /**
   * Creates the secure payment UI bound to the runtime client secret.
   * Requires `initialize` first.
   */
  createElements(clientSecret: string): Promise<void>;

  /**
   * Mounts the created payment UI into the container (element id or
   * element handle). Requires `createElements` first. Browser-only.
   */
  mountPaymentElement(container: string | HTMLElement): void;

  /**
   * Confirms the payment through the mounted UI and maps the provider
   * result into a `ProviderConfirmationResult`. Requires a mounted
   * element. Browser-only.
   */
  confirmPayment(options: ConfirmPaymentOptions): Promise<ProviderConfirmationResult>;

  /** Tears down the mounted UI and releases provider handles (no-op when empty). */
  destroy(): void;
}
