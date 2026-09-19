/**
 * Adapter tests for the Sub-Phase 9.5 `StripePaymentProvider` (plus the
 * `toProviderConfirmationResult` mapping and the `injectStripeJsScript`
 * loader).
 *
 * The Stripe.js SDK is mocked at the `STRIPE_JS_LOADER` seam so these
 * tests own the adapter logic: script-URL sourcing from
 * `STRIPE_JS_SCRIPT_URL`, handle creation from the environment
 * publishable key, Elements creation/mount sequencing, outcome mapping,
 * teardown, rejection diagnostics (never echoing secrets or keys), and
 * the SSR guards (browser-only work never executes on the server). No
 * network, no real SDK, and no page orchestration is asserted here —
 * wiring arrives in Sub-Phase 9.6.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { PLATFORM_ID } from '@angular/core';
import {
  injectStripeJsScript,
  STRIPE_JS_LOADER,
  STRIPE_JS_SCRIPT_URL,
  StripePaymentProvider,
  toProviderConfirmationResult,
} from './stripe-payment-provider';

/** Opaque script-URL stand-in (the real CDN URL lives in app environments — never here). */
const SCRIPT_URL = 'stripe-js-test-script';
const PUBLISHABLE_KEY = 'pk_test_123';
const CLIENT_SECRET = 'pi_123_secret_abc';

/** Inferred SDK factory type (the concrete type stays module-local to the adapter). */
type StripeFactory = Awaited<ReturnType<typeof injectStripeJsScript>>;

interface MockSdk {
  factory: Mock;
  elements: Mock;
  create: Mock;
  mount: Mock;
  unmount: Mock;
  confirmPayment: Mock;
}

function mockSdk(): MockSdk {
  const sdk: MockSdk = {
    factory: vi.fn(),
    elements: vi.fn(),
    create: vi.fn(),
    mount: vi.fn(),
    unmount: vi.fn(),
    confirmPayment: vi.fn(),
  };
  const element = { mount: sdk.mount, unmount: sdk.unmount };
  const elements = { create: sdk.create.mockReturnValue(element) };
  sdk.elements.mockReturnValue(elements);
  sdk.factory.mockReturnValue({ elements: sdk.elements, confirmPayment: sdk.confirmPayment });
  sdk.confirmPayment.mockResolvedValue({ paymentIntent: { id: 'pi_123', status: 'succeeded' } });
  return sdk;
}

function setup(
  platform: string,
  sdk?: MockSdk,
): { provider: StripePaymentProvider; loader: ReturnType<typeof vi.fn> } {
  TestBed.resetTestingModule();
  // The loader resolves with the factory itself (a function) — the
  // provider calls it with the publishable key, mirroring `window.Stripe`.
  const active = sdk ?? mockSdk();
  const loader = vi.fn(async () => active.factory);
  TestBed.configureTestingModule({
    providers: [
      StripePaymentProvider,
      { provide: PLATFORM_ID, useValue: platform },
      { provide: STRIPE_JS_SCRIPT_URL, useValue: SCRIPT_URL },
      { provide: STRIPE_JS_LOADER, useValue: loader },
    ],
  });
  return { provider: TestBed.inject(StripePaymentProvider), loader };
}

function setupBrowser(sdk?: MockSdk): {
  provider: StripePaymentProvider;
  loader: ReturnType<typeof vi.fn>;
  sdk: MockSdk;
} {
  const active = sdk ?? mockSdk();
  const { provider, loader } = setup('browser', active);
  return { provider, loader, sdk: active };
}

async function initializedBrowser(
  sdk?: MockSdk,
  key: string = PUBLISHABLE_KEY,
): Promise<{ provider: StripePaymentProvider; sdk: MockSdk }> {
  const { provider, sdk: active } = setupBrowser(sdk);
  await provider.initialize({ publishableKey: key });
  return { provider, sdk: active };
}

describe('StripePaymentProvider initialize', () => {
  it('loads the script from the token URL and creates the handle from the key', async () => {
    const { provider, loader, sdk } = setupBrowser();
    await provider.initialize({ publishableKey: PUBLISHABLE_KEY });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(loader).toHaveBeenCalledWith(SCRIPT_URL);
    expect(sdk.factory).toHaveBeenCalledTimes(1);
    expect(sdk.factory).toHaveBeenCalledWith(PUBLISHABLE_KEY);
  });

  it('rejects a blank publishable key without loading anything', async () => {
    const { provider, loader } = setupBrowser();
    await expect(provider.initialize({ publishableKey: '   ' })).rejects.toThrow(
      'Payment provider requires a publishable key.',
    );
    expect(loader).not.toHaveBeenCalled();
  });

  it('rejects a non-function factory without echoing the key', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        StripePaymentProvider,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: STRIPE_JS_SCRIPT_URL, useValue: SCRIPT_URL },
        {
          provide: STRIPE_JS_LOADER,
          useValue: vi.fn(async (): Promise<StripeFactory> => null as unknown as StripeFactory),
        },
      ],
    });
    const provider = TestBed.inject(StripePaymentProvider);
    const rejection = await provider
      .initialize({ publishableKey: PUBLISHABLE_KEY })
      .catch((e) => e);
    expect(String(rejection)).toContain('Payment provider failed to load Stripe.js.');
    expect(String(rejection)).not.toContain(PUBLISHABLE_KEY);
  });

  it('re-establishes the handle on repeated initialization', async () => {
    const { provider, sdk } = setupBrowser();
    await provider.initialize({ publishableKey: PUBLISHABLE_KEY });
    await provider.initialize({ publishableKey: 'pk_test_456' });
    expect(sdk.factory).toHaveBeenCalledTimes(2);
    expect(sdk.factory).toHaveBeenLastCalledWith('pk_test_456');
  });
});

describe('StripePaymentProvider createElements', () => {
  it('creates the payment element bound to the client secret', async () => {
    const { provider, sdk } = await initializedBrowser();
    await provider.createElements(CLIENT_SECRET);

    expect(sdk.elements).toHaveBeenCalledTimes(1);
    expect(sdk.elements).toHaveBeenCalledWith({ clientSecret: CLIENT_SECRET });
    expect(sdk.create).toHaveBeenCalledTimes(1);
    expect(sdk.create).toHaveBeenCalledWith('payment');
  });

  it('requires initialization first', async () => {
    const { provider } = setupBrowser();
    await expect(provider.createElements(CLIENT_SECRET)).rejects.toThrow(
      'Payment provider createElements requires initialization.',
    );
  });

  it('rejects a blank secret without echoing it', async () => {
    const { provider, sdk } = await initializedBrowser();
    await expect(provider.createElements('  ')).rejects.toThrow(
      'Payment provider requires a client secret.',
    );
    expect(sdk.elements).not.toHaveBeenCalled();
  });
});

describe('StripePaymentProvider mountPaymentElement', () => {
  it('mounts into an element handle', async () => {
    const { provider, sdk } = await initializedBrowser();
    await provider.createElements(CLIENT_SECRET);
    const target = document.createElement('div');

    provider.mountPaymentElement(target);
    expect(sdk.mount).toHaveBeenCalledTimes(1);
    expect(sdk.mount).toHaveBeenCalledWith(target);
  });

  it('mounts into a container looked up by id', async () => {
    const { provider, sdk } = await initializedBrowser();
    await provider.createElements(CLIENT_SECRET);
    const target = document.createElement('div');
    target.id = 'payment-element-mount';
    document.body.appendChild(target);
    try {
      provider.mountPaymentElement('payment-element-mount');
      expect(sdk.mount).toHaveBeenCalledWith(target);
    } finally {
      target.remove();
    }
  });

  it('rejects a missing container', async () => {
    const { provider, sdk } = await initializedBrowser();
    await provider.createElements(CLIENT_SECRET);
    expect(() => provider.mountPaymentElement('no-such-container')).toThrow(
      'Payment element container was not found.',
    );
    expect(sdk.mount).not.toHaveBeenCalled();
  });

  it('requires a created element', async () => {
    const { provider, sdk } = await initializedBrowser();
    expect(() => provider.mountPaymentElement(document.createElement('div'))).toThrow(
      'Payment provider mountPaymentElement requires a created payment element.',
    );
    expect(sdk.mount).not.toHaveBeenCalled();
  });
});

describe('StripePaymentProvider confirmPayment', () => {
  it('confirms through the mounted elements and maps success', async () => {
    const { provider, sdk } = await initializedBrowser();
    await provider.createElements(CLIENT_SECRET);

    const result = await provider.confirmPayment({});
    expect(sdk.confirmPayment).toHaveBeenCalledTimes(1);
    expect(sdk.confirmPayment).toHaveBeenCalledWith({
      elements: expect.anything(),
      confirmParams: undefined,
    });
    expect(result).toEqual({ outcome: 'succeeded', message: null });
  });

  it('forwards the return URL for redirect-based methods', async () => {
    const { provider, sdk } = await initializedBrowser();
    await provider.createElements(CLIENT_SECRET);

    await provider.confirmPayment({ returnUrl: 'test-return-url' });
    expect(sdk.confirmPayment).toHaveBeenCalledWith({
      elements: expect.anything(),
      confirmParams: { return_url: 'test-return-url' },
    });
  });

  it('requires created elements', async () => {
    const { provider, sdk } = await initializedBrowser();
    await expect(provider.confirmPayment({})).rejects.toThrow(
      'Payment provider confirmPayment requires created elements.',
    );
    expect(sdk.confirmPayment).not.toHaveBeenCalled();
  });

  it('maps declines to failed with the display message', async () => {
    const sdk = mockSdk();
    sdk.confirmPayment.mockResolvedValue({
      error: { type: 'card_error', code: 'card_declined', message: 'Your card was declined.' },
    });
    const { provider } = await initializedBrowser(sdk);

    await provider.createElements(CLIENT_SECRET);
    await expect(provider.confirmPayment({})).resolves.toEqual({
      outcome: 'failed',
      message: 'Your card was declined.',
    });
  });
});

describe('StripePaymentProvider destroy', () => {
  it('unmounts and releases handles', async () => {
    const { provider, sdk } = await initializedBrowser();
    await provider.createElements(CLIENT_SECRET);
    provider.mountPaymentElement(document.createElement('div'));

    provider.destroy();
    expect(sdk.unmount).toHaveBeenCalledTimes(1);
  });

  it('is safe empty and twice', () => {
    const { provider } = setupBrowser();
    expect(() => provider.destroy()).not.toThrow();
    expect(() => provider.destroy()).not.toThrow();
  });
});

describe('toProviderConfirmationResult', () => {
  it('maps terminal intent statuses', () => {
    expect(
      toProviderConfirmationResult({ paymentIntent: { id: 'pi_1', status: 'succeeded' } }),
    ).toEqual({ outcome: 'succeeded', message: null });
    expect(
      toProviderConfirmationResult({
        error: { type: 'card_error', code: 'card_declined', message: 'Declined.' },
      }),
    ).toEqual({ outcome: 'failed', message: 'Declined.' });
  });

  it('maps non-terminal intent statuses', () => {
    expect(
      toProviderConfirmationResult({ paymentIntent: { id: 'pi_1', status: 'processing' } }),
    ).toEqual({ outcome: 'pending', message: null });
    expect(
      toProviderConfirmationResult({ paymentIntent: { id: 'pi_1', status: 'requires_action' } }),
    ).toEqual({ outcome: 'requiresAction', message: null });
  });

  it('maps user cancellation distinctly from failure', () => {
    expect(toProviderConfirmationResult({ error: { code: 'canceled' } })).toEqual({
      outcome: 'cancelled',
      message: null,
    });
  });

  it('falls through to unknown for novel statuses and empty results', () => {
    expect(
      toProviderConfirmationResult({ paymentIntent: { id: 'pi_1', status: 'refunding' } }),
    ).toEqual({ outcome: 'unknown', message: null });
    expect(toProviderConfirmationResult({})).toEqual({ outcome: 'unknown', message: null });
    expect(toProviderConfirmationResult(null)).toEqual({ outcome: 'unknown', message: null });
    expect(toProviderConfirmationResult(undefined)).toEqual({ outcome: 'unknown', message: null });
  });

  it('nulls a non-string error message', () => {
    expect(toProviderConfirmationResult({ error: { code: 'card_declined' } })).toEqual({
      outcome: 'failed',
      message: null,
    });
  });
});

describe('StripePaymentProvider server platform (SSR safety)', () => {
  it('initializes as a silent no-op without loading anything', async () => {
    const { provider, loader } = setup('server');
    await expect(provider.initialize({ publishableKey: PUBLISHABLE_KEY })).resolves.toBeUndefined();
    expect(loader).not.toHaveBeenCalled();
  });

  it('rejects element creation, mounting, and confirmation loudly', async () => {
    const { provider } = setup('server');
    await expect(provider.createElements(CLIENT_SECRET)).rejects.toThrow(
      'Payment provider createElements requires a browser platform.',
    );
    expect(() => provider.mountPaymentElement(document.createElement('div'))).toThrow(
      'Payment provider mountPaymentElement requires a browser platform.',
    );
    await expect(provider.confirmPayment({})).rejects.toThrow(
      'Payment provider confirmPayment requires a browser platform.',
    );
  });

  it('destroys as a silent no-op', () => {
    const { provider } = setup('server');
    expect(() => provider.destroy()).not.toThrow();
  });

  it('still validates the publishable key on the server', async () => {
    const { provider } = setup('server');
    await expect(provider.initialize({ publishableKey: '' })).rejects.toThrow(
      'Payment provider requires a publishable key.',
    );
  });
});

describe('injectStripeJsScript', () => {
  const URL = 'stripe-js-test-script-for-loader';
  const FACTORY = (() => ({ elements: () => undefined })) as unknown as StripeFactory;

  function untrack(url: string): void {
    document.querySelector(`script[src="${url}"]`)?.remove();
    delete (globalThis as unknown as Record<string, unknown>)['Stripe'];
  }

  it('reuses a pre-existing script tag without appending', async () => {
    untrack(URL);
    const tag = document.createElement('script');
    tag.src = URL;
    document.head.appendChild(tag);
    (globalThis as unknown as Record<string, unknown>)['Stripe'] = FACTORY;
    try {
      const before = document.querySelectorAll(`script[src="${URL}"]`).length;
      await expect(injectStripeJsScript(URL)).resolves.toBe(FACTORY);
      expect(document.querySelectorAll(`script[src="${URL}"]`).length).toBe(before);
    } finally {
      untrack(URL);
    }
  });

  it('appends the script and resolves on load', async () => {
    untrack(URL);
    try {
      const pending = injectStripeJsScript(URL);
      const tag = document.querySelector(`script[src="${URL}"]`) as HTMLScriptElement;
      expect(tag).not.toBeNull();
      (globalThis as unknown as Record<string, unknown>)['Stripe'] = FACTORY;
      tag.dispatchEvent(new Event('load'));
      await expect(pending).resolves.toBe(FACTORY);
    } finally {
      untrack(URL);
    }
  });

  it('removes the script and rejects on error', async () => {
    untrack(URL);
    try {
      const pending = injectStripeJsScript(URL);
      const tag = document.querySelector(`script[src="${URL}"]`) as HTMLScriptElement;
      tag.dispatchEvent(new Event('error'));
      await expect(pending).rejects.toThrow('Payment provider failed to load Stripe.js.');
      expect(document.querySelector(`script[src="${URL}"]`)).toBeNull();
    } finally {
      untrack(URL);
    }
  });

  it('rejects when the factory is absent after load', async () => {
    untrack(URL);
    try {
      const pending = injectStripeJsScript(URL);
      const tag = document.querySelector(`script[src="${URL}"]`) as HTMLScriptElement;
      tag.dispatchEvent(new Event('load'));
      await expect(pending).rejects.toThrow('Payment provider failed to load Stripe.js.');
    } finally {
      untrack(URL);
    }
  });
});
