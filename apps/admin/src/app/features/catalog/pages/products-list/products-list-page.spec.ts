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
import type { ProductResponse } from '@flux/models';
import { CategoryLookupState } from '../../state/category-lookup-state';
import { ProductListState } from '../../state/product-list-state';
import type { AdminProductPage } from '../../models/catalog-admin.models';
import type { CategoryResponse } from '@flux/models';
import { ProductsListPage } from './products-list-page';

function row(id: string, name: string): ProductResponse {
  return {
    id,
    name,
    slug: id,
    description: null,
    seo: null,
    status: 1,
    visibility: 0,
    categoryId: 'cat-1',
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
  };
}

function setup(scenario: {
  page: ResourceState<AdminProductPage>;
  categories?: ResourceState<readonly CategoryResponse[]>;
}): {
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
  const categories = signal(
    scenario.categories ??
      successResource([
        {
          id: 'cat-1',
          name: 'Alpha',
          slug: 'alpha',
          description: null,
          parentId: null,
          status: 0,
          isDeleted: false,
          createdAtUtc: '2026-09-04T10:00:00Z',
          deletedAtUtc: null,
        },
      ]),
  );
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
      { provide: ProductListState, useValue: { page, load, setPage, setFilters, reload } },
      {
        provide: CategoryLookupState,
        useValue: { categories, options: signal([]), load: vi.fn() },
      },
    ],
  });
  window.localStorage.clear();
  return { load, setPage, setFilters, reload };
}

function render(): HTMLElement {
  const fixture = TestBed.createComponent(ProductsListPage);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ProductsListPage', () => {
  it('loads the first page on init and renders rows with pager and creation link', () => {
    const { load } = setup({
      page: successResource<AdminProductPage>({
        items: [row('p1', 'First'), row('p2', 'Second')],
        totalCount: 25,
        pageNumber: 1,
        pageSize: 20,
      }),
    });
    const element = render();

    expect(load).toHaveBeenCalledTimes(1);
    expect(element.querySelector('h1')?.textContent).toBe('Products');
    const body = [...element.querySelectorAll('tbody tr')].map((row) =>
      [...row.querySelectorAll('td')].map((cell) => cell.textContent?.trim()),
    );
    expect(body).toEqual([
      ['First', 'p1', 'Active', 'Visible', 'Alpha'],
      ['Second', 'p2', 'Active', 'Visible', 'Alpha'],
    ]);
    const links = [...element.querySelectorAll('tbody td a')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/catalog/products/p1',
      '/catalog/products/p2',
    ]);
    expect(element.querySelector('admin-pagination')).not.toBeNull();
    expect(element.querySelector('.products-list-new')?.getAttribute('href')).toBe('/new');
  });

  it('commits filters on apply', () => {
    const { setFilters } = setup({ page: emptyResource<AdminProductPage>() });
    const element = render();

    const form = element.querySelector('.products-list-filters') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));

    expect(setFilters).toHaveBeenCalledTimes(1);
    expect(setFilters).toHaveBeenCalledWith({ searchTerm: '', categoryId: '' });
  });

  it('maps filter selections to wire values on apply', () => {
    const { setFilters } = setup({ page: emptyResource<AdminProductPage>() });
    const element = render();

    const search = element.querySelector('#products-filter-search') as HTMLInputElement;
    search.value = 'tee';
    search.dispatchEvent(new Event('input'));
    const status = element.querySelector('#products-filter-status') as HTMLSelectElement;
    status.value = '1';
    status.dispatchEvent(new Event('change'));
    const visibility = element.querySelector('#products-filter-visibility') as HTMLSelectElement;
    visibility.value = '0';
    visibility.dispatchEvent(new Event('change'));

    const form = element.querySelector('.products-list-filters') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));

    expect(setFilters).toHaveBeenCalledWith({
      searchTerm: 'tee',
      status: 1,
      visibility: 0,
      categoryId: '',
    });
  });

  it('clears filters through the filter bar', () => {
    const { setFilters } = setup({ page: loadingResource<AdminProductPage>() });
    const element = render();

    const clear = element.querySelector('.filter-bar-clear') as HTMLButtonElement;
    expect(clear).not.toBeNull();
    clear.click();

    expect(setFilters).toHaveBeenCalledWith({});
  });

  it('commits pager moves through the state', () => {
    const { setPage } = setup({
      page: successResource<AdminProductPage>({
        items: [row('p1', 'First')],
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

  it('renders the loading state while the page loads', () => {
    setup({ page: loadingResource<AdminProductPage>() });
    const element = render();

    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();
  });

  it('renders the empty state for settled pages without rows', () => {
    setup({
      page: emptyResource<AdminProductPage>({
        items: [],
        totalCount: 0,
        pageNumber: 1,
        pageSize: 20,
      }),
    });
    const element = render();

    expect(element.querySelector('flux-empty-state')).not.toBeNull();
    expect(element.textContent).toContain('No products yet');
  });

  it('renders the error state with retry that reloads the page', () => {
    const { reload } = setup({
      page: errorResource<AdminProductPage>(new ApiError({ status: 403, message: 'Forbidden.' })),
    });
    const element = render();

    expect(element.querySelector('flux-error-state')).not.toBeNull();
    (element.querySelector('flux-error-state button') as HTMLButtonElement).click();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('renders the idle shell as loading', () => {
    setup({ page: idleResource<AdminProductPage>() });
    const element = render();

    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();
  });

  it('localizes the list for the active culture', () => {
    setup({
      page: successResource<AdminProductPage>({
        items: [row('p1', 'First')],
        totalCount: 1,
        pageNumber: 1,
        pageSize: 20,
      }),
    });
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('fr');
    try {
      const element = render();

      expect(element.querySelector('h1')?.textContent).toBe('Produits');
      expect(element.querySelector('thead th')?.textContent?.trim()).toBe('Nom');
    } finally {
      cultures.setCulture('en');
    }
  });
});
