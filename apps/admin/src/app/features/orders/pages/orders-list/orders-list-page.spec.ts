import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  emptyResource,
  errorResource,
  idleResource,
  loadingResource,
  provideApi,
  provideAppEnvironment,
  successResource,
  type ResourceState,
} from '@flux/api';
import { CultureService } from '@flux/i18n';
import type { OrderSummaryResponse } from '@flux/models';
import { OrderListState } from '../../state/orders-list-state';
import type { AdminOrderPage } from '../../models/orders-admin.models';
import { OrdersListPage } from './orders-list-page';

function row(orderId: string, orderNumber: string): OrderSummaryResponse {
  return {
    orderId,
    orderNumber,
    status: 'Pending',
    grandTotal: { amount: 59.98, currency: 'USD' },
    itemCount: 2,
    createdAtUtc: '2026-09-28T10:00:00Z',
  };
}

function setup(scenario: { page: ResourceState<AdminOrderPage> }): {
  load: ReturnType<typeof vi.fn>;
  setPage: ReturnType<typeof vi.fn>;
  setFilters: ReturnType<typeof vi.fn>;
  reload: ReturnType<typeof vi.fn>;
} {
  const load = vi.fn();
  const setPage = vi.fn();
  const setFilters = vi.fn();
  const reload = vi.fn();
  const page = signal(scenario.page);
  TestBed.configureTestingModule({
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
      { provide: OrderListState, useValue: { page, load, setPage, setFilters, reload } },
    ],
  });
  window.localStorage.clear();
  return { load, setPage, setFilters, reload };
}

function render(): HTMLElement {
  const fixture = TestBed.createComponent(OrdersListPage);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('OrdersListPage', () => {
  it('loads the first page on init and renders rows with pager and details links', () => {
    const { load } = setup({
      page: successResource<AdminOrderPage>({
        items: [row('o1', 'ORD-AAA'), row('o2', 'ORD-BBB')],
        totalCount: 25,
        pageNumber: 1,
        pageSize: 20,
      }),
    });
    const element = render();

    expect(load).toHaveBeenCalledTimes(1);
    expect(element.querySelector('h1')?.textContent).toBe('Orders');
    const body = [...element.querySelectorAll('tbody tr')].map((row) =>
      [...row.querySelectorAll('td')].map((cell) => cell.textContent?.trim()),
    );
    expect(body).toHaveLength(2);
    expect(body[0]?.[0]).toBe('ORD-AAA');
    expect(body[0]?.[1]).toBe('Pending');
    expect(body[1]?.[0]).toBe('ORD-BBB');
    const links = [...element.querySelectorAll('tbody td a')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/orders/o1', '/orders/o2']);
    expect(element.querySelector('admin-pagination')).not.toBeNull();
  });

  it('renders one status badge per row through the cell template', () => {
    setup({
      page: successResource<AdminOrderPage>({
        items: [row('o1', 'ORD-AAA'), row('o2', 'ORD-BBB')],
        totalCount: 2,
        pageNumber: 1,
        pageSize: 20,
      }),
    });
    const element = render();

    const badges = [...element.querySelectorAll('tbody app-order-status-badge flux-badge .badge')];
    expect(badges).toHaveLength(2);
    expect(badges.map((badge) => badge.textContent?.trim())).toEqual(['Pending', 'Pending']);
    expect(badges.map((badge) => badge.getAttribute('data-variant'))).toEqual(['info', 'info']);
  });

  it('commits pager moves through the state', () => {
    const { setPage } = setup({
      page: successResource<AdminOrderPage>({
        items: [row('o1', 'ORD-AAA')],
        totalCount: 25,
        pageNumber: 1,
        pageSize: 20,
      }),
    });
    const element = render();

    const next = [...element.querySelectorAll('admin-pagination button')].find(
      (button) => button.textContent?.trim() === 'Next',
    ) as HTMLButtonElement;
    next.click();

    expect(setPage).toHaveBeenCalledWith(2);
  });

  it('commits filters on apply', () => {
    const { setFilters } = setup({
      page: successResource<AdminOrderPage>({
        items: [row('o1', 'ORD-AAA')],
        totalCount: 1,
        pageNumber: 1,
        pageSize: 20,
      }),
    });
    const element = render();

    const form = element.querySelector('.orders-list-filters') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));

    expect(setFilters).toHaveBeenCalledTimes(1);
  });

  it('clears filters through the filter bar', () => {
    const { setFilters } = setup({ page: loadingResource<AdminOrderPage>() });
    const element = render();

    const clear = element.querySelector('.filter-bar-clear') as HTMLButtonElement;
    expect(clear).not.toBeNull();
    clear.click();

    expect(setFilters).toHaveBeenCalledWith({});
  });

  it('renders the loading state while the page loads', () => {
    setup({ page: loadingResource<AdminOrderPage>() });
    const element = render();

    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();
  });

  it('renders the empty state for settled pages without rows', () => {
    setup({
      page: emptyResource<AdminOrderPage>({
        items: [],
        totalCount: 0,
        pageNumber: 1,
        pageSize: 20,
      }),
    });
    const element = render();

    expect(element.querySelector('flux-empty-state')).not.toBeNull();
    expect(element.textContent).toContain('No orders found');
  });

  it('renders the error state with retry that reloads the page', () => {
    const { reload } = setup({
      page: errorResource<AdminOrderPage>(new ApiError({ status: 403, message: 'Forbidden.' })),
    });
    const element = render();

    expect(element.querySelector('flux-error-state')).not.toBeNull();
    (element.querySelector('flux-error-state button') as HTMLButtonElement).click();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('renders the idle shell as loading', () => {
    setup({ page: idleResource<AdminOrderPage>() });
    const element = render();

    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();
  });

  it('localizes the list for the active culture', () => {
    setup({
      page: successResource<AdminOrderPage>({
        items: [row('o1', 'ORD-AAA')],
        totalCount: 1,
        pageNumber: 1,
        pageSize: 20,
      }),
    });
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('fr');
    try {
      const element = render();

      expect(element.querySelector('h1')?.textContent).toBe('Commandes');
      expect(element.querySelector('thead th')?.textContent?.trim()).toBe('Commande');
    } finally {
      cultures.setCulture('en');
    }
  });

  it('renders the list under the RTL culture without key leakage', () => {
    setup({
      page: successResource<AdminOrderPage>({
        items: [row('o1', 'ORD-AAA')],
        totalCount: 1,
        pageNumber: 1,
        pageSize: 20,
      }),
    });
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('ar');
    try {
      const element = render();

      expect(element.querySelector('h1')?.textContent).toBe('الطلبات');
      expect(element.querySelector('thead th')?.textContent?.trim()).toBe('الطلب');
      expect(element.textContent).not.toContain('orders.list.heading');
      expect(element.querySelector('admin-pagination')).not.toBeNull();
    } finally {
      cultures.setCulture('en');
    }
  });
});
