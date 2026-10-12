import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import {
  errorResource,
  idleResource,
  loadingResource,
  provideApi,
  provideAppEnvironment,
  successResource,
  type ResourceState,
} from '@flux/api';
import { ApiError } from '@flux/api';
import { AuthService } from '@flux/auth';
import { CultureService } from '@flux/i18n';
import type { AdminDashboardResponse } from '@flux/models';
import { DashboardApiService } from './data-access/dashboard-api.service';
import { DashboardState } from './state/dashboard-state';
import { DashboardPage } from './dashboard-page';

function snapshot(overrides: Partial<AdminDashboardResponse> = {}): AdminDashboardResponse {
  return {
    orders: { total: 7, pending: 4, confirmed: 2, cancelled: 1 },
    payments: {
      total: 7,
      pending: 1,
      processing: 1,
      succeeded: 3,
      failed: 1,
      cancelled: 0,
      refunded: 1,
      totalsByCurrency: [{ currency: 'USD', succeededCount: 3, succeededTotalAmount: 179.94 }],
      refundedTotalsByCurrency: [],
    },
    inventory: {
      totalItems: 12,
      totalOnHand: 100,
      totalReserved: 5,
      lowStockItems: 2,
      pendingReservations: 1,
      committedReservations: 0,
      releasedReservations: 0,
      expiredReservations: 0,
    },
    catalog: {
      totalProducts: 4,
      activeProducts: 2,
      totalCategories: 1,
      totalVariants: 6,
    },
    users: {
      total: 3,
      pending: 0,
      active: 3,
      suspended: 0,
      locked: 0,
      deleted: 0,
      customers: 1,
      admins: 1,
      superAdmins: 1,
      unverified: 0,
      lockedOut: 0,
    },
    recentOrders: [
      {
        orderId: 'order-1',
        orderNumber: 'ORD-ABC123',
        status: 'Pending',
        grandTotal: { amount: 59.98, currency: 'USD' },
        itemCount: 2,
        createdAtUtc: '2026-09-28T10:00:00Z',
      },
    ],
    recentPayments: [],
    recentUsers: [],
    dailySeries: [],
    ...overrides,
  };
}

function setup(scenario: {
  snapshot?: ResourceState<AdminDashboardResponse>;
  roles?: readonly string[];
  permissions?: readonly string[];
}): { refresh: ReturnType<typeof vi.fn> } {
  const refresh = vi.fn();
  TestBed.configureTestingModule({
    imports: [DashboardPage],
    providers: [
      provideAppEnvironment({
        name: 'development',
        production: false,
        appName: 'test',
        apiBaseUrl: '/api',
      }),
      provideApi(),
      provideHttpClientTesting(),
      provideRouter([]),
      {
        provide: DashboardState,
        useValue: { snapshot: signal(scenario.snapshot ?? idleResource()), refresh },
      },
      {
        provide: DashboardApiService,
        useValue: { getDashboard: vi.fn(() => of({ isSuccess: true, data: snapshot() })) },
      },
    ],
  });
  window.localStorage.clear();
  TestBed.inject(AuthService).setAuthenticated({
    user: {
      id: '22222222-2222-2222-2222-222222222222',
      email: 'boss@flux.local',
      displayName: 'Boss Admin',
      roles: [...(scenario.roles ?? ['Admin'])],
      permissions: [...(scenario.permissions ?? [])],
      isEmailVerified: true,
      avatarUrl: null,
    },
    accessToken: 'test-access-token',
  });
  return { refresh };
}

function render(): HTMLElement {
  const fixture = TestBed.createComponent(DashboardPage);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('DashboardPage', () => {
  it('renders the session card with the administrator facts', () => {
    setup({ snapshot: successResource(snapshot()) });
    const element = render();

    expect(element.querySelector('h1')?.textContent).toBe('Dashboard');
    expect(element.querySelector('.dashboard-session')?.textContent).toContain('Boss Admin');
    expect(element.querySelector('.dashboard-session')?.textContent).toContain('boss@flux.local');
    expect(element.querySelector('.dashboard-session')?.textContent).toContain('Admin');
  });

  it('loads the snapshot on init and renders every section verbatim', () => {
    const { refresh } = setup({
      snapshot: successResource(snapshot()),
      permissions: ['orders.read'],
    });
    const element = render();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(element.querySelector('h1')?.textContent).toBe('Dashboard');
    expect(element.textContent).toContain('7 orders');
    expect(element.textContent).toContain('7 payments');
    expect(element.textContent).toContain('12 items');
    expect(element.textContent).toContain('4 products');
    expect(element.textContent).toContain('3 users');
    expect(element.querySelector('.dashboard-recent-items')).not.toBeNull();
    expect(element.textContent).toContain('ORD-ABC123');
    expect(element.querySelector('a')).not.toBeNull();
  });

  it('deep-links sections and recent orders to the owning features', () => {
    setup({ snapshot: successResource(snapshot()), roles: ['SuperAdmin'] });
    const element = render();

    const hrefs = [...element.querySelectorAll('.dashboard-card-link')].map((link) =>
      link.getAttribute('href'),
    );
    expect(hrefs).toEqual([
      '/orders/list',
      '/payments/list',
      '/inventory/stock',
      '/catalog/products',
      '/users/list',
    ]);
    expect(element.querySelector('.dashboard-recent-link')?.getAttribute('href')).toBe(
      '/orders/order-1',
    );
  });

  it('shows the users drill-down whenever the users section is present', () => {
    setup({ snapshot: successResource(snapshot()), roles: ['Admin'] });
    const element = render();

    const hrefs = [...element.querySelectorAll('.dashboard-card-link')].map((link) =>
      link.getAttribute('href'),
    );
    expect(hrefs).toEqual([
      '/orders/list',
      '/payments/list',
      '/inventory/stock',
      '/catalog/products',
      '/users/list',
    ]);
    expect(element.textContent).toContain('3 users');
  });

  it('renders only the entitled sections for a catalog-only snapshot', () => {
    setup({
      snapshot: successResource(
        snapshot({
          orders: null,
          payments: null,
          inventory: null,
          users: null,
          recentOrders: [],
        }),
      ),
      permissions: ['catalog.manage'],
    });
    const element = render();

    expect(element.querySelector('.dashboard-session')).not.toBeNull();
    expect(element.textContent).toContain('Catalog');
    expect(element.textContent).toContain('4 products');
    expect(element.textContent).not.toContain('7 orders');
    expect(element.textContent).not.toContain('7 payments');
    expect(element.textContent).not.toContain('12 items');
    expect(element.textContent).not.toContain('3 users');
    expect(element.querySelector('.dashboard-empty')).toBeNull();
    // Gated: no orders.read → the recent-orders widget (incl. its empty state) stays hidden.
    expect(element.querySelector('#dashboard-recent-heading')).toBeNull();
    expect(element.querySelector('.dashboard-recent-items')).toBeNull();
    expect(element.textContent).not.toContain('No recent orders.');
    const hrefs = [...element.querySelectorAll('.dashboard-card-link')].map((link) =>
      link.getAttribute('href'),
    );
    expect(hrefs).toEqual(['/catalog/products']);
  });

  it('renders the honest empty state when no section is entitled', () => {
    setup({
      snapshot: successResource(
        snapshot({
          orders: null,
          payments: null,
          inventory: null,
          catalog: null,
          users: null,
          recentOrders: [],
        }),
      ),
    });
    const element = render();

    expect(element.querySelector('.dashboard-session')).not.toBeNull();
    expect(element.querySelector('.dashboard-grid')).toBeNull();
    expect(element.querySelector('.dashboard-recent')).toBeNull();
    expect(element.querySelector('.dashboard-empty')).not.toBeNull();
    expect(element.textContent).toContain('No sections available');
  });

  it('hides the users card when the users section is absent', () => {
    setup({ snapshot: successResource(snapshot({ users: null })), roles: ['SuperAdmin'] });
    const element = render();

    expect(element.textContent).not.toContain('3 users');
    expect(element.textContent).toContain('7 orders');
  });

  it('renders the recent-orders empty state without rows', () => {
    setup({
      snapshot: successResource(snapshot({ recentOrders: [] })),
      permissions: ['orders.read'],
    });
    const element = render();

    expect(element.querySelector('.dashboard-recent-items')).toBeNull();
    expect(element.textContent).toContain('No recent orders.');
  });

  it('renders the loading state while the snapshot loads', () => {
    setup({ snapshot: loadingResource() });
    const element = render();

    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();
    expect(element.querySelector('.dashboard-grid')).toBeNull();
  });

  it('renders the error state with retry that re-enters refresh', () => {
    const { refresh } = setup({
      snapshot: errorResource(new ApiError({ status: 403, message: 'Forbidden.' })),
    });
    const element = render();

    expect(element.querySelector('flux-error-state')).not.toBeNull();
    expect(element.textContent).toContain('Could not load overview');

    const retry = element.querySelector('flux-error-state button');
    expect(retry).not.toBeNull();
    (retry as HTMLButtonElement).click();

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('localizes the dashboard for the active culture', () => {
    setup({ snapshot: successResource(snapshot()), permissions: ['orders.read'] });
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('fr');
    try {
      const element = render();

      expect(element.querySelector('h1')?.textContent).toBe('Tableau de bord');
      expect(element.textContent).toContain('7 commandes');
      expect(element.textContent).toContain('4 produits');
      expect(element.textContent).toContain('Commandes récentes');
    } finally {
      cultures.setCulture('en');
    }
  });

  it('renders the dashboard under the RTL culture without key leakage', () => {
    setup({ snapshot: successResource(snapshot()), permissions: ['orders.read'] });
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('ar');
    try {
      const element = render();

      expect(element.querySelector('h1')?.textContent).toBe('لوحة التحكم');
      expect(element.textContent).toContain('أحدث الطلبات');
      expect(element.textContent).toContain('الكتالوج');
      expect(element.textContent).not.toContain('dashboard.title');
      expect(element.textContent).not.toContain('dashboard.recent.title');
      expect(element.textContent).not.toContain('dashboard.sections.catalogTitle');
      expect(element.textContent).not.toContain('dashboard.empty.title');
    } finally {
      cultures.setCulture('en');
    }
  });

  it('renders the net-revenue row on the payments card', () => {
    setup({ snapshot: successResource(snapshot()) });
    const element = render();

    expect(element.textContent).toContain('USD · Net');
    expect(element.textContent).toContain('$179.94');
  });

  it('renders recent payments with drill-down for payments.read holders', () => {
    setup({
      snapshot: successResource(
        snapshot({
          recentPayments: [
            {
              id: 'pay-1',
              orderId: 'order-1',
              customerId: 'cust-1',
              amount: 59.98,
              currency: 'USD',
              status: 'Succeeded',
              providerPaymentIntentId: 'pi_123',
              provider: 'stripe',
              createdAtUtc: '2026-09-28T10:00:00Z',
              updatedAtUtc: '2026-09-28T10:01:00Z',
              version: 3,
            },
          ],
        }),
      ),
      permissions: ['payments.read'],
    });
    const element = render();

    expect(element.querySelector('#dashboard-recent-payments-heading')?.textContent).toBe(
      'Recent payments',
    );
    const widget = element.querySelector('#dashboard-recent-payments-heading')?.closest('article');
    expect(widget?.querySelector('.dashboard-recent-link')?.getAttribute('href')).toBe(
      '/payments/pay-1',
    );
  });

  it('hides recent payments from stats-only viewers', () => {
    setup({
      snapshot: successResource(snapshot()),
      permissions: ['payments.stats'],
    });
    const element = render();

    expect(element.textContent).toContain('7 payments');
    expect(element.querySelector('#dashboard-recent-payments-heading')).toBeNull();
  });

  it('renders recent users with drill-down for users.read holders', () => {
    setup({
      snapshot: successResource(
        snapshot({
          recentUsers: [
            {
              id: 'user-9',
              email: 'ada@flux.local',
              roles: ['Customer'],
              isEmailVerified: true,
              registeredAtUtc: '2026-09-28T10:00:00Z',
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
              failedAccessAttemptCount: 0,
              lockoutEndUtc: null,
              isLocked: false,
            },
          ],
        }),
      ),
      permissions: ['users.read'],
    });
    const element = render();

    expect(element.querySelector('#dashboard-recent-users-heading')?.textContent).toBe(
      'Recent users',
    );
    expect(element.textContent).toContain('Ada Lovelace');
  });

  it('renders the daily-series chart with verbatim dates', () => {
    setup({
      snapshot: successResource(
        snapshot({
          dailySeries: [
            { date: '2026-10-04', orders: 0, revenue: [] },
            {
              date: '2026-10-05',
              orders: 2,
              revenue: [{ currency: 'USD', amount: 140 }],
            },
          ],
        }),
      ),
    });
    const element = render();

    expect(element.querySelector('#dashboard-series-heading')?.textContent).toContain('last 30');
    expect(element.querySelectorAll('app-series-chart rect')).toHaveLength(2);
    expect(element.textContent).toContain('2026-10-05');
  });

  it('hides recent orders from viewers without orders.read', () => {
    setup({
      snapshot: successResource(snapshot()),
      permissions: ['catalog.manage'],
    });
    const element = render();

    expect(element.querySelector('#dashboard-recent-heading')).toBeNull();
    expect(element.querySelector('.dashboard-recent-items')).toBeNull();
    expect(element.textContent).not.toContain('ORD-ABC123');
  });

  it('renders recent orders for orders.read holders', () => {
    setup({
      snapshot: successResource(snapshot()),
      permissions: ['orders.read'],
    });
    const element = render();

    expect(element.querySelector('#dashboard-recent-heading')).not.toBeNull();
    expect(element.textContent).toContain('ORD-ABC123');
  });

  it('renders the series strip as labeled day columns', () => {
    setup({
      snapshot: successResource(
        snapshot({
          dailySeries: [
            { date: '2026-10-04', orders: 0, revenue: [] },
            {
              date: '2026-10-05',
              orders: 2,
              revenue: [{ currency: 'USD', amount: 140 }],
            },
          ],
        }),
      ),
    });
    const element = render();

    expect(element.querySelectorAll('.series-chart-day')).toHaveLength(2);
    expect(element.textContent).toContain('Revenue · USD');
  });

  it('renders the daily-series newest-first', () => {
    setup({
      snapshot: successResource(
        snapshot({
          dailySeries: [
            { date: '2026-10-04', orders: 0, revenue: [] },
            {
              date: '2026-10-05',
              orders: 2,
              revenue: [{ currency: 'USD', amount: 140 }],
            },
          ],
        }),
      ),
    });
    const element = render();

    const dates = [...element.querySelectorAll('.series-chart-points > li .series-chart-date')].map(
      (node) => node.textContent?.trim(),
    );
    expect(dates).toEqual(['2026-10-05', '2026-10-04']);
  });
});
