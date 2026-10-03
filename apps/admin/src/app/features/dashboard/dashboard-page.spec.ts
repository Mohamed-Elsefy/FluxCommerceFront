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
    ...overrides,
  };
}

function setup(scenario: {
  snapshot?: ResourceState<AdminDashboardResponse>;
  roles?: readonly string[];
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
      permissions: [],
      isEmailVerified: true,
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
    const { refresh } = setup({ snapshot: successResource(snapshot()) });
    const element = render();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(element.querySelector('h1')?.textContent).toBe('Dashboard');
    expect(element.textContent).toContain('7 orders');
    expect(element.textContent).toContain('7 payments');
    expect(element.textContent).toContain('12 items');
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
    expect(hrefs).toEqual(['/orders/list', '/payments/list', '/inventory/stock', '/users/list']);
    expect(element.querySelector('.dashboard-recent-link')?.getAttribute('href')).toBe(
      '/orders/order-1',
    );
  });

  it('hides the users drill-down for non-SuperAdmin roles', () => {
    setup({ snapshot: successResource(snapshot()), roles: ['Admin'] });
    const element = render();

    const hrefs = [...element.querySelectorAll('.dashboard-card-link')].map((link) =>
      link.getAttribute('href'),
    );
    expect(hrefs).toEqual(['/orders/list', '/payments/list', '/inventory/stock']);
    expect(element.textContent).toContain('3 users');
  });

  it('renders the recent-orders empty state without rows', () => {
    setup({ snapshot: successResource(snapshot({ recentOrders: [] })) });
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
    setup({ snapshot: successResource(snapshot()) });
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('fr');
    try {
      const element = render();

      expect(element.querySelector('h1')?.textContent).toBe('Tableau de bord');
      expect(element.textContent).toContain('7 commandes');
      expect(element.textContent).toContain('Commandes récentes');
    } finally {
      cultures.setCulture('en');
    }
  });

  it('renders the dashboard under the RTL culture without key leakage', () => {
    setup({ snapshot: successResource(snapshot()) });
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('ar');
    try {
      const element = render();

      expect(element.querySelector('h1')?.textContent).toBe('لوحة التحكم');
      expect(element.textContent).toContain('أحدث الطلبات');
      expect(element.textContent).not.toContain('dashboard.title');
      expect(element.textContent).not.toContain('dashboard.recent.title');
    } finally {
      cultures.setCulture('en');
    }
  });
});
