/**
 * Feature integration tests for Sub-Phase 10.9 — Testing, E2E & Phase
 * Completion.
 *
 * Verifies the production contract paths end to end with the real layers
 * wired and only HTTP stubbed:
 *
 * ```text
 * OrdersListState / OrderDetailsState / AccountState (real feature state)
 *     ↓ OrdersApiService / IdentityApiService (real data access)
 *     ↓ ApiClient (shared transport, real — incl. interceptors)
 *     ↓ HttpTestingController (stands in for ASP.NET Core)
 *     ↓ Backend Orders + Identity contracts (contract-exact fixtures)
 * ```
 *
 * Covers the §10.9 integration matrix over the wire: paged list reads
 * (exact query strings, response-effective adoption, empty pages),
 * single-order reads (ownership-shaped errors, verbatim unknown
 * statuses), cancel transport, profile reads, and untouched error
 * propagation for `400` validation, `401` anonymous, `403` denial, and
 * `404` unknown-or-foreign ids.
 *
 * No live backend is reachable from this environment, so
 * `HttpTestingController` stands in with contract-exact fixtures
 * (`ApiResponse` envelopes, camelCase wire casing, GUID ids) — the same
 * convention as the Phase 5–7 integration specs.
 */

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  provideApi,
  provideAppEnvironment,
  IdentityApiService,
  type AppEnvironment,
} from '@flux/api';
import { AuthService } from '@flux/auth';
import type { UserResponse } from '@flux/models';
import type { Order, OrderStatus, OrderSummary } from '../models/orders.models';
import { OrdersApiService } from './orders-api.service';
import { OrdersListState } from '../state/orders-list-state';
import { OrderDetailsState } from '../state/order-details-state';
import { AccountState } from '../state/account-state';

const environment: AppEnvironment = {
  name: 'development',
  production: false,
  appName: 'test',
  apiBaseUrl: '/api',
};

const ORDER_A = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

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

function order(overrides: Partial<Order> = {}): Order {
  return {
    orderId: ORDER_A,
    orderNumber: 'ORD-ABC123DEF456',
    status: 'Pending',
    subtotal: { amount: 59.98, currency: 'USD' },
    shippingCost: { amount: 0, currency: 'USD' },
    discount: { amount: 0, currency: 'USD' },
    grandTotal: { amount: 59.98, currency: 'USD' },
    itemCount: 2,
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

function profile(): UserResponse {
  return {
    id: USER_ID,
    email: 'ada@flux.local',
    roles: ['Customer'],
    isEmailVerified: true,
    registeredAtUtc: '2026-09-04T10:00:00Z',
    firstName: 'Ada',
    lastName: 'Lovelace',
    displayName: 'Ada Lovelace',
    phoneNumber: null,
    isPhoneVerified: false,
    avatarUrl: null,
    preferredLanguage: 'en',
    timeZone: 'UTC',
    status: 1,
    permissions: [],
  };
}

function envelope(data: unknown): Record<string, unknown> {
  return { isSuccess: true, message: 'Operation completed successfully.', data };
}

function problem(status: number, title: string, detail: string): Record<string, unknown> {
  return { type: 'about:blank', title, status, detail, extensions: {} };
}

describe('orders feature integration (state → api → contract)', () => {
  let list: OrdersListState;
  let details: OrderDetailsState;
  let account: AccountState;
  let ordersApi: OrdersApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideAppEnvironment(environment),
        provideApi(),
        provideHttpClientTesting(),
        provideRouter([]),
        AuthService,
        IdentityApiService,
        OrdersApiService,
        OrdersListState,
        OrderDetailsState,
        AccountState,
      ],
    });
    list = TestBed.inject(OrdersListState);
    details = TestBed.inject(OrderDetailsState);
    account = TestBed.inject(AccountState);
    ordersApi = TestBed.inject(OrdersApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('reads the first page with the exact query string and adopts it', () => {
    list.loadPage();

    const pending = http.expectOne('/api/orders?pageNumber=1&pageSize=20');
    expect(pending.request.method).toBe('GET');
    pending.flush(envelope({ items: [summary()], totalCount: 1, pageNumber: 1, pageSize: 20 }));

    expect(list.status()).toBe('success');
    expect(list.page()?.items).toHaveLength(1);
    expect(list.page()?.items[0]?.orderNumber).toBe('ORD-ABC123DEF456');
    expect(list.currentPage()).toBe(1);
  });

  it('carries committed page moves onto the wire', () => {
    list.loadPage(3);

    const pending = http.expectOne('/api/orders?pageNumber=3&pageSize=20');
    expect(pending.request.method).toBe('GET');
    pending.flush(envelope({ items: [summary()], totalCount: 45, pageNumber: 3, pageSize: 20 }));

    expect(list.status()).toBe('success');
    expect(list.page()?.pageNumber).toBe(3);
    expect(list.page()?.totalCount).toBe(45);
  });

  it('resolves zero-item pages to empty over the wire', () => {
    list.loadPage();

    http
      .expectOne('/api/orders?pageNumber=1&pageSize=20')
      .flush(envelope({ items: [], totalCount: 0, pageNumber: 1, pageSize: 20 }));

    expect(list.status()).toBe('empty');
  });

  it('maps a 400 validation rejection to the list error slot', () => {
    list.loadPage(0);

    http
      .expectOne('/api/orders?pageNumber=1&pageSize=20')
      .flush(problem(400, 'Bad Request', 'Validation failed.'), {
        status: 400,
        statusText: 'Bad Request',
      });

    expect(list.status()).toBe('error');
    expect(list.error()?.status).toBe(400);
  });

  it('maps a 401 list read to the error slot (unauthorized view driver)', () => {
    list.loadPage();

    http
      .expectOne('/api/orders?pageNumber=1&pageSize=20')
      .flush(problem(401, 'Unauthorized', 'Anonymous.'), {
        status: 401,
        statusText: 'Unauthorized',
      });

    expect(list.status()).toBe('error');
    expect(list.error()?.status).toBe(401);
  });

  it('reads one order with the id-scoped template and adopts it verbatim', () => {
    details.loadOrder(ORDER_A);

    const pending = http.expectOne(`/api/orders/${ORDER_A}`);
    expect(pending.request.method).toBe('GET');
    pending.flush(envelope(order()));

    expect(details.status()).toBe('success');
    expect(details.order()?.orderNumber).toBe('ORD-ABC123DEF456');
    // Backend money echoes untouched — never recomputed from lines.
    expect(details.order()?.grandTotal).toEqual({ amount: 59.98, currency: 'USD' });
    expect(details.order()?.lineItems[0]?.lineTotal).toBe(59.98);
  });

  it('adopts unknown backend statuses verbatim over the wire', () => {
    details.loadOrder(ORDER_A);

    // Deliberately out-of-contract value (cast only — the wire is
    // untyped JSON): the UI must echo it, never map it.
    http
      .expectOne(`/api/orders/${ORDER_A}`)
      .flush(envelope(order({ status: 'Shipped' as OrderStatus })));

    expect(details.status()).toBe('success');
    expect(details.order()?.status).toBe('Shipped');
  });

  it('maps a 404 details read to the error slot (unknown-or-foreign id)', () => {
    details.loadOrder(ORDER_A);

    http.expectOne(`/api/orders/${ORDER_A}`).flush(problem(404, 'Not Found', 'Order not found.'), {
      status: 404,
      statusText: 'Not Found',
    });

    expect(details.status()).toBe('error');
    expect(details.error()?.status).toBe(404);
  });

  it('maps a 403 details read to the error slot (forbidden view driver)', () => {
    details.loadOrder(ORDER_A);

    http.expectOne(`/api/orders/${ORDER_A}`).flush(problem(403, 'Forbidden', 'Denied.'), {
      status: 403,
      statusText: 'Forbidden',
    });

    expect(details.status()).toBe('error');
    expect(details.error()?.status).toBe(403);
  });

  it('posts order cancellation to the id-scoped template with no body', () => {
    ordersApi.cancelOrder(ORDER_A).subscribe();

    const pending = http.expectOne(`/api/orders/${ORDER_A}/cancel`);
    expect(pending.request.method).toBe('POST');
    pending.flush(envelope(order({ status: 'Cancelled' })));
  });

  it('reads the live profile and adopts it into the account slot', () => {
    account.loadProfile();

    const pending = http.expectOne('/api/auth/me');
    expect(pending.request.method).toBe('GET');
    pending.flush(envelope(profile()));

    expect(account.status()).toBe('success');
    expect(account.profile()?.email).toBe('ada@flux.local');
    expect(account.profile()?.displayName).toBe('Ada Lovelace');
  });

  it('maps a 401 profile read to the error slot (session-expiry driver)', () => {
    account.loadProfile();

    http.expectOne('/api/auth/me').flush(problem(401, 'Unauthorized', 'Anonymous.'), {
      status: 401,
      statusText: 'Unauthorized',
    });

    expect(account.status()).toBe('error');
    expect(account.error()?.status).toBe(401);
    expect(account.profile()).toBeNull();
  });
});
