/**
 * Page tests for the Sub-Phase 10.3 `OrdersListPage`.
 *
 * Covers page orchestration only (projection lives in
 * `order-summary-row.spec.ts`, resource rules in
 * `orders-list-state.spec.ts`, transport in
 * `orders-api.service.spec.ts`): the loading shell before the page
 * settles, success rendering of preformatted rows with details links,
 * empty rendering without a pager, error rendering with retry recovery,
 * pager-driven page moves through the state, the single-request
 * guarantee, and localized copy with the document title.
 *
 * The real `OrdersListState` and `CultureService` are wired to a
 * stubbed `OrdersApiService` transport, so these tests pin the full
 * page → state → data-access delegation path without HTTP.
 *
 * Backend-authority pins: rows echo stubbed backend payloads (no math
 * performed here); status renders verbatim; no payment status exists
 * anywhere (no such contract field).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { of, Subject, throwError, type Observable } from 'rxjs';
import { ApiError, type PagedApiResponse, type PagedResult } from '@flux/api';
import { CultureService } from '@flux/i18n';
import type { OrderSummary } from '../../models/orders.models';
import { ORDERS_DEFAULT_PAGE_SIZE } from '../../models/orders.models';
import { OrdersApiService } from '../../data-access/orders-api.service';
import { OrdersListState } from '../../state/orders-list-state';
import { OrdersListPage } from './orders-list-page';

const ORDER_A = '11111111-1111-4111-8111-111111111111';
const ORDER_B = '22222222-2222-4222-8222-222222222222';

function summary(overrides: Partial<OrderSummary> = {}): OrderSummary {
  return {
    orderId: ORDER_A,
    orderNumber: 'ORD-ABC123DEF456',
    status: 'Confirmed',
    grandTotal: { amount: 59.98, currency: 'USD' },
    itemCount: 2,
    createdAtUtc: '2026-09-04T10:00:00Z',
    ...overrides,
  };
}

function page(overrides: Partial<PagedResult<OrderSummary>> = {}): PagedResult<OrderSummary> {
  return {
    items: [summary()],
    totalCount: 1,
    pageNumber: 1,
    pageSize: ORDERS_DEFAULT_PAGE_SIZE,
    ...overrides,
  };
}

function envelope(data: PagedResult<OrderSummary> | null): PagedApiResponse<OrderSummary> {
  return { isSuccess: true, data };
}

async function setup(
  source: () => Observable<PagedApiResponse<OrderSummary>> = () => of(envelope(page())),
): Promise<{
  fixture: ComponentFixture<OrdersListPage>;
  api: { getOrders: ReturnType<typeof vi.fn> };
}> {
  const api = { getOrders: vi.fn(source) };

  await TestBed.configureTestingModule({
    imports: [OrdersListPage],
    providers: [
      provideRouter([]),
      CultureService,
      OrdersListState,
      { provide: OrdersApiService, useValue: api },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(OrdersListPage);
  TestBed.inject(CultureService).setCulture('en');
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, api };
}

function textOf(fixture: ComponentFixture<OrdersListPage>, selector: string): string | null {
  return fixture.nativeElement.querySelector(selector)?.textContent?.trim() ?? null;
}

describe('OrdersListPage loading', () => {
  it('renders the loading shell before the page settles', async () => {
    const pending = new Subject<PagedApiResponse<OrderSummary>>();
    const { fixture } = await setup(() => pending.asObservable());

    expect(fixture.nativeElement.querySelector('flux-loading-indicator')).not.toBeNull();
    expect(textOf(fixture, '#orders-list-page-title')).toBe('Orders');

    pending.next(envelope(page()));
    pending.complete();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('flux-loading-indicator')).toBeNull();
    expect(fixture.nativeElement.querySelector('ol')).not.toBeNull();
  });

  it('issues exactly one page request across init triggers', async () => {
    const { api } = await setup();
    expect(api.getOrders).toHaveBeenCalledTimes(1);
  });
});

describe('OrdersListPage success', () => {
  it('renders one row per backend order with a details link', async () => {
    const { fixture } = await setup(() =>
      of(
        envelope(
          page({
            items: [summary(), summary({ orderId: ORDER_B, orderNumber: 'ORD-XYZ789GHI012' })],
            totalCount: 2,
          }),
        ),
      ),
    );

    const rows = [...fixture.nativeElement.querySelectorAll('orders-order-summary-row')];
    expect(rows).toHaveLength(2);
    const links = [
      ...fixture.nativeElement.querySelectorAll('orders-order-summary-row a'),
    ] as HTMLAnchorElement[];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      `/account/orders/${ORDER_A}`,
      `/account/orders/${ORDER_B}`,
    ]);
  });

  it('renders backend values verbatim with no payment status', async () => {
    const { fixture } = await setup();
    const text = fixture.nativeElement.textContent ?? '';

    expect(text).toContain('ORD-ABC123DEF456');
    expect(text).toContain('Confirmed');
    expect(text).not.toMatch(/payment/i);
  });

  it('hides the pager for single-page results', async () => {
    const { fixture } = await setup();
    expect(fixture.nativeElement.querySelector('orders-pagination nav')).toBeNull();
  });

  it('sets the localized document title', async () => {
    await setup();
    expect(TestBed.inject(Title).getTitle()).toBe('Orders');
  });

  it('localizes copy with the active culture', async () => {
    const { fixture } = await setup();
    TestBed.inject(CultureService).setCulture('fr');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(textOf(fixture, '#orders-list-page-title')).toBe('Commandes');
    expect(TestBed.inject(Title).getTitle()).toBe('Commandes');

    TestBed.inject(CultureService).setCulture('en');
  });
});

describe('OrdersListPage pagination', () => {
  it('renders the pager from response-effective values and moves pages', async () => {
    const pageOne = page({
      items: [summary()],
      totalCount: 45,
      pageNumber: 1,
    });
    const pageTwo = page({
      items: [summary({ orderId: ORDER_B, orderNumber: 'ORD-XYZ789GHI012' })],
      totalCount: 45,
      pageNumber: 2,
    });
    const api = { getOrders: vi.fn(() => of(envelope(pageOne))) };

    await TestBed.configureTestingModule({
      imports: [OrdersListPage],
      providers: [
        provideRouter([]),
        CultureService,
        OrdersListState,
        { provide: OrdersApiService, useValue: api },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OrdersListPage);
    TestBed.inject(CultureService).setCulture('en');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('orders-pagination nav')).not.toBeNull();

    vi.mocked(api.getOrders).mockReturnValue(of(envelope(pageTwo)));
    const next = [...fixture.nativeElement.querySelectorAll('orders-pagination nav button')].find(
      (button: HTMLButtonElement) => button.textContent?.trim() === 'Next',
    ) as HTMLButtonElement | undefined;
    expect(next).toBeTruthy();
    next?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(api.getOrders).toHaveBeenLastCalledWith(
      { pageNumber: 2, pageSize: ORDERS_DEFAULT_PAGE_SIZE },
      expect.objectContaining({}),
    );
    const links = [
      ...fixture.nativeElement.querySelectorAll('orders-order-summary-row a'),
    ] as HTMLAnchorElement[];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([`/account/orders/${ORDER_B}`]);

    TestBed.inject(CultureService).setCulture('en');
  });
});

describe('OrdersListPage empty', () => {
  it('renders the empty state without rows or a pager', async () => {
    const { fixture } = await setup(() => of(envelope(page({ items: [], totalCount: 0 }))));

    expect(fixture.nativeElement.querySelector('flux-empty-state')).not.toBeNull();
    expect(textOf(fixture, 'flux-empty-state')).toContain('No orders yet');
    expect(fixture.nativeElement.querySelector('ol')).toBeNull();
    expect(fixture.nativeElement.querySelector('orders-pagination nav')).toBeNull();
  });
});

describe('OrdersListPage errors', () => {
  it('renders the failure with retry and recovers on retry', async () => {
    const api = { getOrders: vi.fn() };
    vi.mocked(api.getOrders).mockReturnValueOnce(
      throwError(() => new ApiError({ status: 401, message: 'Anonymous.' })),
    );
    vi.mocked(api.getOrders).mockReturnValue(of(envelope(page())));

    await TestBed.configureTestingModule({
      imports: [OrdersListPage],
      providers: [
        provideRouter([]),
        CultureService,
        OrdersListState,
        { provide: OrdersApiService, useValue: api },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OrdersListPage);
    TestBed.inject(CultureService).setCulture('en');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('flux-error-state')).not.toBeNull();
    expect(textOf(fixture, 'flux-error-state')).toContain('Orders unavailable');

    const retry = fixture.nativeElement.querySelector(
      'flux-error-state button',
    ) as HTMLButtonElement;
    expect(retry).not.toBeNull();
    retry.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(api.getOrders).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('flux-error-state')).toBeNull();
    expect(fixture.nativeElement.querySelector('ol')).not.toBeNull();

    TestBed.inject(CultureService).setCulture('en');
  });
});

describe('OrdersListPage focus management', () => {
  it('moves focus to the heading on entry', async () => {
    const { fixture } = await setup();

    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('#orders-list-page-title'),
    );
    // 11.8: the page contributes no h1 — the account shell owns the section h1.
    expect(fixture.nativeElement.querySelectorAll('h1')).toHaveLength(0);
  });

  it('moves focus to the error banner once per failure', async () => {
    const api = { getOrders: vi.fn() };
    vi.mocked(api.getOrders).mockReturnValue(
      throwError(() => new ApiError({ status: 500, message: 'Server fault.' })),
    );

    await TestBed.configureTestingModule({
      imports: [OrdersListPage],
      providers: [
        provideRouter([]),
        CultureService,
        OrdersListState,
        { provide: OrdersApiService, useValue: api },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OrdersListPage);
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
});

describe('OrdersListPage direction integrity', () => {
  it('renders identical content under RTL direction', async () => {
    document.documentElement.dir = 'rtl';
    try {
      const { fixture } = await setup();

      const links = [
        ...fixture.nativeElement.querySelectorAll('orders-order-summary-row a'),
      ] as HTMLAnchorElement[];
      expect(links.map((link) => link.getAttribute('href'))).toEqual([
        `/account/orders/${ORDER_A}`,
      ]);
      expect(fixture.nativeElement.textContent).toContain('ORD-ABC123DEF456');
    } finally {
      document.documentElement.dir = 'ltr';
      TestBed.inject(CultureService).setCulture('en');
    }
  });
});
