/**
 * Stripe provider adapter for Sub-Phase 9.5 — Stripe.js / Elements
 * Integration Boundary.
 *
 * Scope: `docs/phases/PHASE_9_PAYMENTS.md` §9.5 (the concrete Stripe
 * implementation behind `PaymentProvider` — no wiring, no UI mounting
 * calls, no confirmation actions).
 *
 * Source of truth: `docs/phases/PHASE_9_PAYMENTS.md` §9.5 (isolation
 * rules), `docs/frontend-contract/PAYMENT_INTEGRATION_NOTES.md` §4 (the
 * Stripe.js flow: publishable key from SPA env, provider-side
 * confirmation, `requires_action` handled inside the SDK), and the
 * provider's secure integration model (Payment Element: `elements`
 * bound to the client secret, `create('payment')`, `mount`,
 * `confirmPayment`).
 *
 * Decoupling (the §9.5 target — complete):
 * - Consumers touch ONLY `./payment-provider` (`PaymentProvider`,
 *   `ProviderConfig`, `ConfirmPaymentOptions`,
 *   `ProviderConfirmationResult`). Every Stripe shape below
 *   (`StripeLike` and friends) is module-local — none is exported for
 *   feature use, and this file imports no feature code.
 * - No `@stripe/*` npm dependency: the SDK loads at runtime from the
 *   app-environment script URL through the injectable `STRIPE_JS_LOADER`
 *   seam (default: `injectStripeJsScript`). Tests replace the seam with
 *   a mock factory — the adapter never touches the network in specs.
 * - The script URL travels via the `STRIPE_JS_SCRIPT_URL` token
 *   (provided from app environments by the 9.6 wiring — never
 *   hard-coded here, per the architecture audit's no-URL rule).
 *
 * SSR safety (the §9.5/§9.11 rule — browser-only code never executes on
 * the server):
 * - Every method checks `PLATFORM_ID` first. `initialize` and `destroy`
 *   are silent no-ops on the server (safe setup/teardown defaults);
 *   `createElements`, `mountPaymentElement`, and `confirmPayment` reject
 *   with a browser-only diagnostic (executing them server-side would
 *   mean a real SSR leak — fail loud, never silent).
 * - The default loader additionally refuses non-DOM runtimes.
 *
 * Outcome mapping (`toProviderConfirmationResult` — pure, test-pinned):
 *
 * ```text
 * intent succeeded                                              → succeeded
 * intent processing                                             → pending
 * intent requires_action                                        → requiresAction
 * intent requires_payment_method (method rejected)              → failed
 * intent requires_confirmation / requires_capture / unknown     → pending|unknown
 * error code 'canceled'                                         → cancelled
 * any other error                                               → failed (+ message)
 * neither error nor intent                                      → unknown
 * ```
 *
 * Sensitive-data rule: the client secret passes through to
 * `stripe.elements` only (never stored beyond the Elements handle,
 * never logged, never echoed in diagnostics — rejections name the
 * missing value, never its content). Decline messages pass through
 * verbatim for display; raw payloads never leave the SDK call.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 9.6 — no route providers registration, no initialization wiring,
 *   no Elements mounting calls, no page orchestration.
 * - 9.7 — no confirmation user actions (this file maps outcomes; the
 *   page triggers them).
 */

import { inject, Injectable, InjectionToken, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { ProviderConfirmationOutcome } from '@flux/models';
import type {
  ConfirmPaymentOptions,
  PaymentProvider,
  ProviderConfig,
  ProviderConfirmationResult,
} from './payment-provider';

/** Backend-confirmed paid intent status. */
const INTENT_SUCCEEDED = 'succeeded';
/** Async-processing intent status (webhook lag — resolve via status read). */
const INTENT_PROCESSING = 'processing';
/** Additional customer action required (3-DS — the SDK manages the modal). */
const INTENT_REQUIRES_ACTION = 'requires_action';
/** Payment method rejected at confirmation time. */
const INTENT_REQUIRES_PAYMENT_METHOD = 'requires_payment_method';
/** User-abort error code surfaced by the SDK. */
const ERROR_CANCELED = 'canceled';

/** Stripe PaymentIntent facts used by the mapping table (id + status only). */
interface StripePaymentIntentLike {
  readonly id: string;
  readonly status: string;
}

/** Stripe error facts used by the mapping table (never the raw payload). */
interface StripeErrorLike {
  readonly type?: string;
  readonly code?: string;
  readonly message?: string;
  readonly decline_code?: string;
}

/** `stripe.confirmPayment` result shape (error XOR intent). */
interface StripeConfirmPaymentResultLike {
  readonly error?: StripeErrorLike | null;
  readonly paymentIntent?: StripePaymentIntentLike | null;
}

/** Created payment UI handle (mount/unmount only — no styling API here). */
interface StripePaymentElementLike {
  mount(target: string | HTMLElement): void;
  unmount(): void;
}

/** Elements group bound to one client secret. */
interface StripeElementsLike {
  create(type: 'payment'): StripePaymentElementLike;
}

/**
 * Exact Stripe.js surface this adapter uses — nothing more. Structural
 * (not the SDK types): the SDK arrives at runtime, so the adapter
 * depends on shape, never on an npm package.
 */
interface StripeLike {
  elements(options: { clientSecret: string }): StripeElementsLike;
  confirmPayment(options: {
    elements: StripeElementsLike;
    confirmParams?: { return_url?: string };
    redirect?: 'if_required' | 'always';
  }): Promise<StripeConfirmPaymentResultLike>;
}

/** Factory producing the Stripe handle from the environment publishable key. */
type StripeJsFactory = (publishableKey: string) => StripeLike;

/**
 * Loads the Stripe.js SDK from the app-environment script URL and
 * resolves with its factory. Browser-only — rejects outside a DOM
 * runtime. Reuses an already-injected script tag (idempotent across
 * re-initialization).
 */
export type StripeJsLoader = (scriptUrl: string) => Promise<StripeJsFactory>;

/**
 * Script URL token (Stripe.js CDN). No default — the 9.6 wiring provides
 * it from app environments (the audit forbids hard-coded URLs in app
 * code). Missing provision fails loudly at injection time.
 */
export const STRIPE_JS_SCRIPT_URL = new InjectionToken<string>('STRIPE_JS_SCRIPT_URL');

/**
 * Publishable-key token (the environment publishable key — the ONLY
 * Stripe key the SPA may hold, §9.1 `SPA_STRIPE_KEY_SLOT`). No default —
 * the 9.6 wiring provides it from app environments alongside the script
 * URL. Missing provision fails loudly at injection time.
 */
export const STRIPE_PUBLISHABLE_KEY = new InjectionToken<string>('STRIPE_PUBLISHABLE_KEY');

/**
 * Loader seam (default: runtime script injection). Tests provide a mock
 * factory — the adapter never touches the network in specs.
 */
export const STRIPE_JS_LOADER = new InjectionToken<StripeJsLoader>('STRIPE_JS_LOADER', {
  factory: () => injectStripeJsScript,
});

/**
 * Default loader: injects the Stripe.js script once and resolves with
 * `window.Stripe`. Rejects when the script errors, when the factory is
 * absent after load, or outside a DOM runtime. Pure infrastructure —
 * performs no payment logic.
 */
export function injectStripeJsScript(scriptUrl: string): Promise<StripeJsFactory> {
  if (typeof globalThis.document === 'undefined') {
    return Promise.reject(new Error('Payment provider requires a browser platform.'));
  }
  const doc = globalThis.document;
  const existing = doc.querySelector(`script[src="${scriptUrl}"]`);
  if (existing !== null) {
    return readStripeFactory();
  }
  return new Promise<StripeJsFactory>((resolve, reject) => {
    const script = doc.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    script.onload = () => {
      readStripeFactory().then(resolve, reject);
    };
    script.onerror = () => {
      script.remove();
      reject(new Error('Payment provider failed to load Stripe.js.'));
    };
    doc.head.appendChild(script);
  });
}

/** Reads `window.Stripe` after the script is present (loaded or pre-existing). */
function readStripeFactory(): Promise<StripeJsFactory> {
  const factory = (globalThis as unknown as { Stripe?: StripeJsFactory }).Stripe;
  if (typeof factory !== 'function') {
    return Promise.reject(new Error('Payment provider failed to load Stripe.js.'));
  }
  return Promise.resolve(factory);
}

/**
 * Maps a `confirmPayment` result into the §9.1 outcome buckets. Unknown
 * intent statuses fall through to `unknown` (forward-compatible — never
 * crash, never guess success). Pure — throws nothing.
 */
export function toProviderConfirmationResult(
  result: StripeConfirmPaymentResultLike | null | undefined,
): ProviderConfirmationResult {
  const error = result?.error ?? null;
  if (error !== null) {
    return {
      outcome: error.code === ERROR_CANCELED ? 'cancelled' : 'failed',
      message: typeof error.message === 'string' ? error.message : null,
    };
  }
  const status = result?.paymentIntent?.status;
  if (typeof status !== 'string') {
    return { outcome: 'unknown', message: null };
  }
  const outcome: ProviderConfirmationOutcome =
    status === INTENT_SUCCEEDED
      ? 'succeeded'
      : status === INTENT_PROCESSING
        ? 'pending'
        : status === INTENT_REQUIRES_ACTION
          ? 'requiresAction'
          : status === INTENT_REQUIRES_PAYMENT_METHOD
            ? 'failed'
            : 'unknown';
  return { outcome, message: null };
}

/** Whether the value is a usable (non-blank) string. */
function isNonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Stripe provider adapter. Feature-scoped (`@Injectable()` WITHOUT
 * `providedIn` — the 9.6 wiring registers it at the payments route
 * level next to `PaymentState`). Drive it ONLY through the
 * `PaymentProvider` interface.
 */
@Injectable()
export class StripePaymentProvider implements PaymentProvider {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly scriptUrl = inject(STRIPE_JS_SCRIPT_URL);
  private readonly loader = inject(STRIPE_JS_LOADER);

  private stripe: StripeLike | null = null;
  private elements: StripeElementsLike | null = null;
  private element: StripePaymentElementLike | null = null;

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  /**
   * Loads Stripe.js (deduped by the loader) and establishes the SDK
   * handle for the environment publishable key. Re-entrant (safe to
   * call again — re-establishes the handle). Silent no-op on the
   * server. Rejects on a blank key or a failed load — the diagnostic
   * never echoes the key.
   */
  async initialize(config: ProviderConfig): Promise<void> {
    if (!isNonBlank(config?.publishableKey)) {
      throw new Error('Payment provider requires a publishable key.');
    }
    if (!this.isBrowser) {
      return;
    }
    const factory = await this.loader(this.scriptUrl);
    if (typeof factory !== 'function') {
      throw new Error('Payment provider failed to load Stripe.js.');
    }
    this.stripe = factory(config.publishableKey);
    this.elements = null;
    this.element = null;
  }

  /**
   * Creates the Payment Element bound to the runtime client secret.
   * Requires `initialize` first. Rejects on the server, without a
   * handle, or on a blank secret — diagnostics never echo the secret.
   */
  async createElements(clientSecret: string): Promise<void> {
    this.requireBrowser('createElements');
    const stripe = this.requireStripe('createElements');
    if (!isNonBlank(clientSecret)) {
      throw new Error('Payment provider requires a client secret.');
    }
    this.elements = stripe.elements({ clientSecret });
    this.element = this.elements.create('payment');
  }

  /**
   * Mounts the created element into the container (element id or
   * handle). Requires `createElements` first. Rejects on the server,
   * on a missing container, or without a created element.
   */
  mountPaymentElement(container: string | HTMLElement): void {
    this.requireBrowser('mountPaymentElement');
    const target =
      typeof container === 'string' ? globalThis.document.getElementById(container) : container;
    if (target === null || target === undefined) {
      throw new Error('Payment element container was not found.');
    }
    const element = this.requireElement('mountPaymentElement');
    element.mount(target);
  }

  /**
   * Confirms through the mounted element and maps the SDK result (3-DS
   * `requires_action` is managed inside the SDK call). Requires a
   * mounted element. Rejects on the server or without elements — the
   * rejection never carries payment payloads.
   */
  async confirmPayment(options: ConfirmPaymentOptions = {}): Promise<ProviderConfirmationResult> {
    this.requireBrowser('confirmPayment');
    const stripe = this.requireStripe('confirmPayment');
    const elements = this.requireElements('confirmPayment');
    // In-place card confirmation has no return URL. Newer Stripe.js builds
    // reject a missing `confirmParams.return_url` unless the call opts out
    // of automatic redirects, so request `if_required` (redirect only for
    // 3-DS / redirect methods). With an explicit returnUrl keep the default
    // redirect behaviour.
    const result = await stripe.confirmPayment(
      options.returnUrl === undefined
        ? { elements, redirect: 'if_required' as const }
        : { elements, confirmParams: { return_url: options.returnUrl } },
    );
    return toProviderConfirmationResult(result);
  }

  /**
   * Unmounts the element and releases handles (script tag stays cached
   * for re-initialization). Safe to call empty or twice; silent no-op
   * on the server.
   */
  destroy(): void {
    if (!this.isBrowser) {
      return;
    }
    try {
      this.element?.unmount();
    } finally {
      this.element = null;
      this.elements = null;
    }
  }

  /** Rejects server-platform calls with a loud diagnostic (SSR-leak surfacing). */
  private requireBrowser(operation: string): void {
    if (!this.isBrowser) {
      throw new Error(`Payment provider ${operation} requires a browser platform.`);
    }
  }

  /** Requires an established SDK handle. */
  private requireStripe(operation: string): StripeLike {
    if (this.stripe === null) {
      throw new Error(`Payment provider ${operation} requires initialization.`);
    }
    return this.stripe;
  }

  /** Requires created Elements. */
  private requireElements(operation: string): StripeElementsLike {
    if (this.elements === null) {
      throw new Error(`Payment provider ${operation} requires created elements.`);
    }
    return this.elements;
  }

  /** Requires a created payment element. */
  private requireElement(operation: string): StripePaymentElementLike {
    if (this.element === null) {
      throw new Error(`Payment provider ${operation} requires a created payment element.`);
    }
    return this.element;
  }
}
