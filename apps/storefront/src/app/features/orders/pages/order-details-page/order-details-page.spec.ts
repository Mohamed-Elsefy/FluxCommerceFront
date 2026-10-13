/**
 * Page tests for the Sub-Phases 10.4 (Order Details) and 10.6 (Order
 * History & Post-Payment Synchronization) `OrderDetailsPage`.
 *
 * Covers page orchestration only (projection lives in
 * `order-details.models.spec.ts`, resource rules in
 * `order-details-state.spec.ts`, sync-loop rules in
 * `order-details-sync.spec.ts`, transport in
 * `orders-api.service.spec.ts`): the loading shell before the order
 * settles, success rendering of backend facts/addresses/items/totals,
 * distinct `404`/`403`/`401`/generic-error handling with their
 * recoveries, blank-id behavior, the single-request guarantee,
 * browser-only auto-sync with pending/exhausted UI, destroy
 * cancellation, history absence, and localized copy with the document
 * title.
 *
 * The real `OrderDetailsState` and `CultureService` are wired to a
 * stubbed `OrdersApiService` transport and a stubbed `:orderId` route,
 * so these tests pin the full page → state → data-access delegation
 * path without HTTP.
 *
 * Backend-authority pins: the settled order echoes the stubbed backend
 * payload (no math performed here); status renders through the §10.5
 * badge; no payment status, tax row, thumbnails, contact details, or
 * history timeline render anywhere (no such contract fields).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { of, Subject, throwError, type Observable } from 'rxjs';
import { ApiError, type ApiResponseWithData } from '@flux/api';
import { CultureService } from '@flux/i18n';
import type { Order } from '../../models/orders.models';
import { OrdersApiService } from '../../data-access/orders-api.service';
import { OrderDetailsState } from '../../state/order-details-state';
import { OrderDetailsPage } from './order-details-page';

const ORDER_A = '11111111-1111-4111-8111-111111111111';

function address() {
  return {
    recipientName: 'Ada Lovelace',
    line1: '1 Flux St',
    line2: null,
    city: 'Berlin',
    region: 'BE',
    postalCode: '10115',
    countryCode: 'DE',
  };
}

function order(overrides: Partial<Order> = {}): Order {
  return {
    orderId: ORDER_A,
    orderNumber: 'ORD-ABC123DEF456',
    status: 'Confirmed',
    subtotal: { amount: 59.98, currency: 'USD' },
    shippingCost: { amount: 5, currency: 'USD' },
    discount: { amount: 2, currency: 'USD' },
    grandTotal: { amount: 62.98, currency: 'USD' },
    itemCount: 1,
    createdAtUtc: '2026-09-04T10:00:00Z',
    shippingAddress: address(),
    billingAddress: address(),
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
    ...overrides,
  };
}

function envelope(data: Order | null): ApiResponseWithData<Order> {
  return { isSuccess: true, data };
}

async function setup(
  source: () => Observable<ApiResponseWithData<Order>> = () => of(envelope(order())),
  routeOrderId: string | null = ORDER_A,
): Promise<{
  fixture: ComponentFixture<OrderDetailsPage>;
  api: { getOrderById: ReturnType<typeof vi.fn> };
}> {
  const api = { getOrderById: vi.fn(source) };
  const paramMap = convertToParamMap(routeOrderId === null ? {} : { orderId: routeOrderId });

  await TestBed.configureTestingModule({
    imports: [OrderDetailsPage],
    providers: [
      provideRouter([]),
      CultureService,
      OrderDetailsState,
      { provide: OrdersApiService, useValue: api },
      { provide: ActivatedRoute, useValue: { paramMap: of(paramMap), snapshot: { paramMap } } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(OrderDetailsPage);
  TestBed.inject(CultureService).setCulture('en');
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, api };
}

function textOf(fixture: ComponentFixture<OrderDetailsPage>, selector: string): string | null {
  return fixture.nativeElement.querySelector(selector)?.textContent?.trim() ?? null;
}

describe('OrderDetailsPage loading', () => {
  it('renders the loading shell before the order settles', async () => {
    const pending = new Subject<ApiResponseWithData<Order>>();
    const { fixture, api } = await setup(() => pending.asObservable());

    expect(fixture.nativeElement.querySelector('flux-loading-indicator')).not.toBeNull();

    pending.next(envelope(order()));
    pending.complete();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('flux-loading-indicator')).toBeNull();
    expect(fixture.nativeElement.querySelector('orders-items-list table')).not.toBeNull();
    expect(api.getOrderById).toHaveBeenCalledWith(ORDER_A, {});
  });

  it('issues exactly one order request across init triggers', async () => {
    const { api } = await setup();
    expect(api.getOrderById).toHaveBeenCalledTimes(1);
  });

  it('fails locally on blank route ids without an HTTP call', async () => {
    const { fixture, api } = await setup(() => of(envelope(order())), null);

    expect(api.getOrderById).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('flux-error-state')).not.toBeNull();
  });
});

describe('OrderDetailsPage success', () => {
  it('renders backend facts, addresses, items, and totals verbatim', async () => {
    const { fixture } = await setup();
    const text = fixture.nativeElement.textContent ?? '';

    expect(textOf(fixture, '#order-details-page-title')).toBe('Order ORD-ABC123DEF456');
    expect(text).toContain(ORDER_A);
    expect(text).toContain('Confirmed');
    expect(text).toContain('Ada Lovelace');
    expect(text).toContain('1 Flux St');
    expect(text).toContain('TEE-BLK-M');
    expect(text).toContain('59.98');
    expect(text).toContain('62.98');
    expect(fixture.nativeElement.querySelectorAll('orders-address-block')).toHaveLength(2);
    expect(TestBed.inject(Title).getTitle()).toBe('Order ORD-ABC123DEF456');
  });

  it('renders no invented capability surface', async () => {
    const { fixture } = await setup();
    const text = fixture.nativeElement.textContent ?? '';

    expect(text).not.toMatch(/payment/i);
    expect(text).not.toMatch(/tax/i);
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.querySelector('form, input, button')).toBeNull();
  });

  it('localizes copy with the active culture', async () => {
    const { fixture } = await setup();
    TestBed.inject(CultureService).setCulture('fr');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(textOf(fixture, '#order-details-page-title')).toBe('Commande ORD-ABC123DEF456');
    expect(TestBed.inject(Title).getTitle()).toBe('Commande ORD-ABC123DEF456');

    TestBed.inject(CultureService).setCulture('en');
  });
});

describe('OrderDetailsPage access failures', () => {
  it('renders the not-found view for unknown or foreign ids', async () => {
    const { fixture } = await setup(() =>
      throwError(() => new ApiError({ status: 404, message: 'Unknown or foreign order.' })),
    );

    expect(textOf(fixture, '#order-details-page-title')).toBe('Order not found');
    expect(textOf(fixture, '.order-details-page-notice')).toContain('another account');
    const back = fixture.nativeElement.querySelector(
      '.order-details-page-notice a',
    ) as HTMLAnchorElement;
    expect(back?.getAttribute('href')).toBe('/account/orders');
    expect(fixture.nativeElement.querySelector('flux-error-state')).toBeNull();
  });

  it('renders the forbidden view on ownership denial', async () => {
    const { fixture } = await setup(() =>
      throwError(() => new ApiError({ status: 403, message: 'Denied.' })),
    );

    expect(textOf(fixture, '#order-details-page-title')).toBe('Access denied');
    expect(textOf(fixture, '.order-details-page-notice')).toContain('permission');
    const back = fixture.nativeElement.querySelector(
      '.order-details-page-notice a',
    ) as HTMLAnchorElement;
    expect(back?.getAttribute('href')).toBe('/account/orders');
  });

  it('renders the unauthorized view with a sign-in link on expired sessions', async () => {
    const { fixture } = await setup(() =>
      throwError(() => new ApiError({ status: 401, message: 'Anonymous.' })),
    );

    expect(textOf(fixture, '#order-details-page-title')).toBe('Sign-in required');
    const links = [
      ...fixture.nativeElement.querySelectorAll('.order-details-page-notice a'),
    ] as HTMLAnchorElement[];
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/login', '/account/orders']);
  });
});

describe('OrderDetailsPage generic errors', () => {
  it('renders the failure with retry and recovers on retry', async () => {
    const api = { getOrderById: vi.fn() };
    vi.mocked(api.getOrderById).mockReturnValueOnce(
      throwError(() => new ApiError({ status: 500, message: 'Server fault.' })),
    );
    vi.mocked(api.getOrderById).mockReturnValue(of(envelope(order())));
    const paramMap = convertToParamMap({ orderId: ORDER_A });

    await TestBed.configureTestingModule({
      imports: [OrderDetailsPage],
      providers: [
        provideRouter([]),
        CultureService,
        OrderDetailsState,
        { provide: OrdersApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { paramMap: of(paramMap), snapshot: { paramMap } } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OrderDetailsPage);
    TestBed.inject(CultureService).setCulture('en');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(textOf(fixture, '#order-details-page-title')).toBe('Order unavailable');
    expect(fixture.nativeElement.querySelector('flux-error-state')).not.toBeNull();

    const retry = fixture.nativeElement.querySelector(
      'flux-error-state button',
    ) as HTMLButtonElement;
    expect(retry).not.toBeNull();
    retry.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(api.getOrderById).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('flux-error-state')).toBeNull();
    expect(textOf(fixture, '#order-details-page-title')).toBe('Order ORD-ABC123DEF456');

    TestBed.inject(CultureService).setCulture('en');
  });
});

describe('OrderDetailsPage focus management', () => {
  it('moves focus to the heading on entry', async () => {
    const { fixture } = await setup();

    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('#order-details-page-title'),
    );
    // 11.8: the page contributes no h1 — the account shell owns the section h1.
    expect(fixture.nativeElement.querySelectorAll('h1')).toHaveLength(0);
  });

  it('moves focus to the generic-error banner once per failure', async () => {
    const api = { getOrderById: vi.fn() };
    vi.mocked(api.getOrderById).mockReturnValue(
      throwError(() => new ApiError({ status: 500, message: 'Server fault.' })),
    );
    const paramMap = convertToParamMap({ orderId: ORDER_A });

    await TestBed.configureTestingModule({
      imports: [OrderDetailsPage],
      providers: [
        provideRouter([]),
        CultureService,
        OrderDetailsState,
        { provide: OrdersApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { paramMap: of(paramMap), snapshot: { paramMap } } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OrderDetailsPage);
    TestBed.inject(CultureService).setCulture('en');
    fixture.detectChanges();
    await fixture.whenStable();

    const banner = fixture.nativeElement.querySelector('[data-error-focus]');
    expect(banner).not.toBeNull();
    expect(document.activeElement).toBe(banner);

    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(banner);

    TestBed.inject(CultureService).setCulture('en');
  });

  it('keeps focus on the heading for stable access views (no error banner)', async () => {
    const { fixture } = await setup(() =>
      throwError(() => new ApiError({ status: 404, message: 'Unknown or foreign order.' })),
    );

    expect(fixture.nativeElement.querySelector('[data-error-focus]')).toBeNull();
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('#order-details-page-title'),
    );
  });
});

describe('OrderDetailsPage sync and direction integrity', () => {
  it('announces polling through a live region', async () => {
    const { fixture } = await setup(() => of(envelope(order({ status: 'Pending' }))));

    const sync = fixture.nativeElement.querySelector('.order-details-page-sync');
    expect(sync).not.toBeNull();
    expect(sync?.getAttribute('role')).toBe('status');
  });

  it('renders identical content under RTL direction', async () => {
    document.documentElement.dir = 'rtl';
    try {
      const { fixture } = await setup();

      expect(fixture.nativeElement.textContent).toContain('ORD-ABC123DEF456');
      expect(fixture.nativeElement.querySelector('orders-items-list table')).not.toBeNull();
      expect(fixture.nativeElement.querySelectorAll('orders-address-block')).toHaveLength(2);
    } finally {
      document.documentElement.dir = 'ltr';
      TestBed.inject(CultureService).setCulture('en');
    }
  });
});

describe('OrderDetailsPage post-payment synchronization', () => {
  it('shows the pending indicator while a non-terminal order syncs', async () => {
    const { fixture } = await setup(() => of(envelope(order({ status: 'Pending' }))));

    const sync = fixture.nativeElement.querySelector('.order-details-page-sync');
    expect(sync).not.toBeNull();
    expect(sync?.textContent?.trim()).toBe('Waiting for the final order status…');
  });

  it('shows no sync indicator for terminal orders', async () => {
    const { fixture } = await setup();

    expect(fixture.nativeElement.querySelector('.order-details-page-sync')).toBeNull();
  });

  it('renders no history timeline (no backend history contract)', async () => {
    const { fixture } = await setup();

    expect(fixture.nativeElement.querySelector('[class*="timeline"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[class*="history"]')).toBeNull();
  });

  it('exhausts the budget with a manual recheck and stops on destroy', async () => {
    vi.useFakeTimers();
    try {
      const api = { getOrderById: vi.fn(() => of(envelope(order({ status: 'Pending' })))) };
      const paramMap = convertToParamMap({ orderId: ORDER_A });

      await TestBed.configureTestingModule({
        imports: [OrderDetailsPage],
        providers: [
          provideRouter([]),
          CultureService,
          OrderDetailsState,
          { provide: OrdersApiService, useValue: api },
          {
            provide: ActivatedRoute,
            useValue: { paramMap: of(paramMap), snapshot: { paramMap } },
          },
        ],
      }).compileComponents();

      const fixture = TestBed.createComponent(OrderDetailsPage);
      TestBed.inject(CultureService).setCulture('en');
      fixture.detectChanges();
      await fixture.whenStable();

      vi.advanceTimersByTime(2000 * 30);
      fixture.detectChanges();

      const exhausted = fixture.nativeElement.querySelector('.order-details-page-sync');
      expect(exhausted?.textContent).toContain('Still processing');
      const recheck = exhausted?.querySelector('button') as HTMLButtonElement | null;
      expect(recheck?.textContent?.trim()).toBe('Check again');

      const calls = vi.mocked(api.getOrderById).mock.calls.length;
      recheck?.click();
      fixture.detectChanges();
      vi.advanceTimersByTime(0);
      expect(vi.mocked(api.getOrderById).mock.calls.length).toBeGreaterThan(calls);

      fixture.destroy();
      const afterDestroy = vi.mocked(api.getOrderById).mock.calls.length;
      vi.advanceTimersByTime(2000 * 30);
      expect(vi.mocked(api.getOrderById).mock.calls.length).toBe(afterDestroy);
    } finally {
      vi.useRealTimers();
      TestBed.inject(CultureService).setCulture('en');
    }
  });
});
