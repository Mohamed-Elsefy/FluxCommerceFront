/**
 * Navigation integration tests for Sub-Phase 10.7 — Routing,
 * Authorization & Account UX.
 *
 * Covers the account area end to end through the REAL route tables
 * (`app.routes` → `accountRoutes` → `ordersRoutes`) with a real router:
 * unauthenticated deep links redirect to login preserving `returnUrl`,
 * authenticated deep links land on the profile, orders list, and order
 * details pages with their feature states wired. Transports
 * (`IdentityApiService`, `OrdersApiService`) and the central
 * `AuthService` session are stubbed at their seams; routing, guards,
 * lazy boundaries, and pages are real.
 *
 * Security-boundary pin: the guard redirect asserted here is UX
 * protection only — backend authorization stays authoritative (every
 * order read re-checks ownership server-side and masks foreign ids as
 * `404`). Nothing here weakens that: anonymous navigation never
 * instantiates an account page.
 */

import { Location } from '@angular/common';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { AuthService, type CurrentUser } from '@flux/auth';
import { IdentityApiService } from '@flux/api';
import { CultureService } from '@flux/i18n';
import type { UserResponse } from '@flux/models';
import { routes } from '../../app.routes';
import { OrdersApiService } from './data-access/orders-api.service';

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

const USER: CurrentUser = {
  id: USER_ID,
  email: 'ada@flux.local',
  displayName: 'Ada Lovelace',
  roles: ['Customer'],
  isEmailVerified: true,
};

function userResponse(): UserResponse {
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
  };
}

function orderSummary() {
  return {
    orderId: ORDER_ID,
    orderNumber: 'ORD-ABC123DEF456',
    status: 'Confirmed',
    grandTotal: { amount: 59.98, currency: 'USD' },
    itemCount: 2,
    createdAtUtc: '2026-09-04T10:00:00Z',
  };
}

function orderDetails() {
  return {
    ...orderSummary(),
    subtotal: { amount: 59.98, currency: 'USD' },
    shippingCost: { amount: 0, currency: 'USD' },
    discount: { amount: 0, currency: 'USD' },
    shippingAddress: {
      recipientName: 'Ada Lovelace',
      line1: '1 Flux St',
      line2: null,
      city: 'Berlin',
      region: 'BE',
      postalCode: '10115',
      countryCode: 'DE',
    },
    billingAddress: {
      recipientName: 'Ada Lovelace',
      line1: '1 Flux St',
      line2: null,
      city: 'Berlin',
      region: 'BE',
      postalCode: '10115',
      countryCode: 'DE',
    },
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
  };
}

@Component({
  selector: 'account-navigation-test-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
class TestRoot {}

async function setup(authenticated: boolean): Promise<{
  fixture: ComponentFixture<TestRoot>;
  router: Router;
  location: Location;
}> {
  TestBed.resetTestingModule();
  const currentUser = signal(authenticated ? USER : null);
  const identity = {
    getCurrentUser: vi.fn(() => of({ isSuccess: true, data: userResponse() })),
  };
  const orders = {
    getOrders: vi.fn(() =>
      of({
        isSuccess: true,
        data: { items: [orderSummary()], totalCount: 1, pageNumber: 1, pageSize: 20 },
      }),
    ),
    getOrderById: vi.fn(() => of({ isSuccess: true, data: orderDetails() })),
  };

  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      CultureService,
      {
        provide: AuthService,
        useValue: {
          isAuthenticated: signal(authenticated),
          isInitializing: signal(false),
          initialized: signal(true),
          currentUser,
          updateCurrentUser: vi.fn(),
          logout: vi.fn(() => of(undefined)),
        },
      },
      { provide: IdentityApiService, useValue: identity },
      { provide: OrdersApiService, useValue: orders },
    ],
  });

  const fixture = TestBed.createComponent(TestRoot);
  TestBed.inject(CultureService).setCulture('en');
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, router: TestBed.inject(Router), location: TestBed.inject(Location) };
}

describe('Account deep links without a session', () => {
  it('redirects anonymous order-details deep links to login with returnUrl', async () => {
    const { fixture, router, location } = await setup(false);

    await router.navigateByUrl(`/account/orders/${ORDER_ID}`);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(decodeURIComponent(location.path())).toBe(
      `/login?returnUrl=/account/orders/${ORDER_ID}`,
    );
    expect(fixture.nativeElement.querySelector('account-shell')).toBeNull();
    TestBed.inject(CultureService).setCulture('en');
  });

  it('redirects anonymous orders-list deep links to login with returnUrl', async () => {
    const { fixture, router, location } = await setup(false);

    await router.navigateByUrl('/account/orders');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(decodeURIComponent(location.path())).toBe('/login?returnUrl=/account/orders');
    expect(fixture.nativeElement.querySelector('account-shell')).toBeNull();
    TestBed.inject(CultureService).setCulture('en');
  });
});

describe('Account deep links with a session', () => {
  it('lands profile deep links on the account shell with the profile page', async () => {
    const { fixture, router, location } = await setup(true);

    await router.navigateByUrl('/account/profile');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(location.path()).toBe('/account/profile');
    expect(fixture.nativeElement.querySelector('account-shell')).not.toBeNull();
    const headings = [...fixture.nativeElement.querySelectorAll('h1')].map((heading) =>
      heading.textContent?.trim(),
    );
    expect(headings).toContain('My account');
    expect(headings).toContain('Profile');
    TestBed.inject(CultureService).setCulture('en');
  });

  it('redirects the account root to the profile section', async () => {
    const { fixture, router, location } = await setup(true);

    await router.navigateByUrl('/account');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(location.path()).toBe('/account/profile');
    expect(fixture.nativeElement.querySelector('profile-page')).not.toBeNull();
    TestBed.inject(CultureService).setCulture('en');
  });

  it('lands orders-list deep links on the list with backend rows', async () => {
    const { fixture, router, location } = await setup(true);

    await router.navigateByUrl('/account/orders');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(location.path()).toBe('/account/orders');
    expect(fixture.nativeElement.querySelector('account-shell')).not.toBeNull();
    const links = [
      ...fixture.nativeElement.querySelectorAll('orders-order-summary-row a'),
    ] as HTMLAnchorElement[];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([`/account/orders/${ORDER_ID}`]);
    TestBed.inject(CultureService).setCulture('en');
  });

  it('lands order-details deep links on the details page with backend facts', async () => {
    const { fixture, router, location } = await setup(true);

    await router.navigateByUrl(`/account/orders/${ORDER_ID}`);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(location.path()).toBe(`/account/orders/${ORDER_ID}`);
    expect(fixture.nativeElement.querySelector('order-details-page')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('ORD-ABC123DEF456');
    expect(fixture.nativeElement.textContent).toContain('Confirmed');
    TestBed.inject(CultureService).setCulture('en');
  });
});
