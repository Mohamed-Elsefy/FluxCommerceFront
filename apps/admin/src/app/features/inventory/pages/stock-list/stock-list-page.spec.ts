import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  emptyResource,
  errorResource,
  loadingResource,
  provideApi,
  provideAppEnvironment,
  successResource,
  type ResourceState,
} from '@flux/api';
import { CultureService } from '@flux/i18n';
import { StockListState } from '../../state/stock-list-state';
import type { AdminStockPage } from '../../models/inventory-admin.models';
import { StockListPage } from './stock-list-page';

function row(sku: string) {
  return {
    sku,
    onHandQuantity: 10,
    reservedQuantity: 2,
    availableQuantity: 8,
    updatedAtUtc: '2026-09-04T10:00:00Z',
  };
}

function setup(scenario: { page?: ResourceState<AdminStockPage> }): {
  load: ReturnType<typeof vi.fn>;
  setPage: ReturnType<typeof vi.fn>;
  setFilters: ReturnType<typeof vi.fn>;
  reload: ReturnType<typeof vi.fn>;
} {
  const load = vi.fn();
  const setPage = vi.fn();
  const setFilters = vi.fn();
  const reload = vi.fn();
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
      {
        provide: StockListState,
        useValue: {
          page: signal(scenario.page ?? loadingResource<AdminStockPage>()),
          load,
          setPage,
          setFilters,
          reload,
        },
      },
    ],
  });
  window.localStorage.clear();
  return { load, setPage, setFilters, reload };
}

function render(): HTMLElement {
  const fixture = TestBed.createComponent(StockListPage);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('StockListPage', () => {
  it('loads the first page on init and renders rows with deep links', () => {
    const { load } = setup({
      page: successResource<AdminStockPage>({
        items: [row('AAA'), row('BBB')],
        totalCount: 2,
        pageNumber: 1,
        pageSize: 20,
      }),
    });
    const element = render();

    expect(load).toHaveBeenCalledTimes(1);
    expect(element.querySelector('h1')?.textContent).toBe('Stock list');
    const links = [...element.querySelectorAll('admin-data-table a')].map((node) =>
      node.getAttribute('href'),
    );
    expect(links).toContain('/inventory/stock/AAA');
    expect(links).toContain('/inventory/stock/BBB');
  });

  it('commits filters on apply', () => {
    const { setFilters } = setup({ page: emptyResource<AdminStockPage>() });
    const element = render();

    const form = element.querySelector('.stock-list-filters') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));

    expect(setFilters).toHaveBeenCalledTimes(1);
  });

  it('clears filters through the filter bar', () => {
    const { setFilters } = setup({ page: loadingResource<AdminStockPage>() });
    const element = render();

    const clear = element.querySelector('.filter-bar-clear') as HTMLButtonElement;
    expect(clear).not.toBeNull();
    clear.click();

    expect(setFilters).toHaveBeenCalledWith({});
  });

  it('commits pager moves through the state', () => {
    const { setPage } = setup({
      page: successResource<AdminStockPage>({
        items: [row('AAA')],
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

  it('renders the empty state for out-of-range pages', () => {
    setup({ page: emptyResource<AdminStockPage>() });
    const element = render();

    expect(element.querySelector('admin-data-table')).not.toBeNull();
    expect(element.textContent).toContain('No stock found');
  });

  it('renders the error state with retry', () => {
    const { reload } = setup({
      page: errorResource<AdminStockPage>(new ApiError({ status: 400, message: 'Invalid.' })),
    });
    const element = render();

    expect(element.querySelector('flux-error-state')).not.toBeNull();
    const retry = element.querySelector('flux-error-state button') as HTMLButtonElement;
    retry.click();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('localizes the list for the active culture', () => {
    setup({
      page: successResource<AdminStockPage>({
        items: [row('AAA')],
        totalCount: 1,
        pageNumber: 1,
        pageSize: 20,
      }),
    });
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('fr');
    try {
      const element = render();

      expect(element.querySelector('h1')?.textContent).toBe('Liste du stock');
    } finally {
      cultures.setCulture('en');
    }
  });

  it('renders the list under the RTL culture without key leakage', () => {
    setup({
      page: successResource<AdminStockPage>({
        items: [row('AAA')],
        totalCount: 1,
        pageNumber: 1,
        pageSize: 20,
      }),
    });
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('ar');
    try {
      const element = render();

      expect(element.querySelector('h1')?.textContent).toBe('قائمة المخزون');
      expect(element.textContent).not.toContain('inventory.stockList.heading');
    } finally {
      cultures.setCulture('en');
    }
  });
});
