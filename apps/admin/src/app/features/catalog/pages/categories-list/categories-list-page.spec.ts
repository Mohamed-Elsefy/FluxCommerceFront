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
import type { CategoryResponse } from '@flux/models';
import { CategoryListState } from '../../state/category-list-state';
import { CategoryLookupState } from '../../state/category-lookup-state';
import type { AdminCategoryPage } from '../../models/catalog-admin.models';
import { CategoriesListPage } from './categories-list-page';

function row(id: string, name: string, parentId: string | null = null): CategoryResponse {
  return {
    id,
    name,
    slug: id,
    description: null,
    parentId,
    status: 0,
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
  };
}

function setup(scenario: { page: ResourceState<AdminCategoryPage> }): {
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
        provide: CategoryListState,
        useValue: { page: signal(scenario.page), load, setPage, setFilters, reload },
      },
      {
        provide: CategoryLookupState,
        useValue: {
          categories: signal(successResource([row('c0', 'Root')])),
          options: signal([]),
          load: vi.fn(),
        },
      },
    ],
  });
  window.localStorage.clear();
  return { load, setPage, setFilters, reload };
}

function render(): HTMLElement {
  const fixture = TestBed.createComponent(CategoriesListPage);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('CategoriesListPage', () => {
  it('loads the first page on init and renders rows with pager and creation link', () => {
    const { load } = setup({
      page: successResource<AdminCategoryPage>({
        items: [row('c1', 'Alpha'), row('c2', 'Beta', 'c0')],
        totalCount: 25,
        pageNumber: 1,
        pageSize: 20,
      }),
    });
    const element = render();

    expect(load).toHaveBeenCalledTimes(1);
    expect(element.querySelector('h1')?.textContent).toBe('Categories');
    const body = [...element.querySelectorAll('tbody tr')].map((row) =>
      [...row.querySelectorAll('td')].map((cell) => cell.textContent?.trim()),
    );
    expect(body).toEqual([
      ['Alpha', 'c1', 'Active', '—'],
      ['Beta', 'c2', 'Active', 'Root'],
    ]);
    const links = [...element.querySelectorAll('tbody td a')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/catalog/categories/c1',
      '/catalog/categories/c2',
    ]);
    expect(element.querySelector('admin-pagination')).not.toBeNull();
    expect(element.querySelector('.categories-list-new')?.getAttribute('href')).toBe('/new');
  });

  it('commits filters on apply', () => {
    const { setFilters } = setup({ page: emptyResource<AdminCategoryPage>() });
    const element = render();

    const form = element.querySelector('.categories-list-filters') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));

    expect(setFilters).toHaveBeenCalledTimes(1);
    expect(setFilters).toHaveBeenCalledWith({ searchTerm: '' });
  });

  it('maps filter selections to wire values on apply', () => {
    const { setFilters } = setup({ page: emptyResource<AdminCategoryPage>() });
    const element = render();

    const search = element.querySelector('#categories-filter-search') as HTMLInputElement;
    search.value = 'apparel';
    search.dispatchEvent(new Event('input'));
    const status = element.querySelector('#categories-filter-status') as HTMLSelectElement;
    status.value = '0';
    status.dispatchEvent(new Event('change'));

    const form = element.querySelector('.categories-list-filters') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));

    expect(setFilters).toHaveBeenCalledWith({ searchTerm: 'apparel', status: 0 });
  });

  it('clears filters through the filter bar', () => {
    const { setFilters } = setup({ page: loadingResource<AdminCategoryPage>() });
    const element = render();

    const clear = element.querySelector('.filter-bar-clear') as HTMLButtonElement;
    expect(clear).not.toBeNull();
    clear.click();

    expect(setFilters).toHaveBeenCalledWith({});
  });

  it('commits pager moves through the state', () => {
    const { setPage } = setup({
      page: successResource<AdminCategoryPage>({
        items: [row('c1', 'Alpha')],
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
    setup({ page: loadingResource<AdminCategoryPage>() });
    const element = render();

    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();
  });

  it('renders the empty state for settled pages without rows', () => {
    setup({
      page: emptyResource<AdminCategoryPage>({
        items: [],
        totalCount: 0,
        pageNumber: 1,
        pageSize: 20,
      }),
    });
    const element = render();

    expect(element.querySelector('flux-empty-state')).not.toBeNull();
    expect(element.textContent).toContain('No categories yet');
  });

  it('renders the error state with retry that reloads the page', () => {
    const { reload } = setup({
      page: errorResource<AdminCategoryPage>(new ApiError({ status: 403, message: 'Forbidden.' })),
    });
    const element = render();

    expect(element.querySelector('flux-error-state')).not.toBeNull();
    (element.querySelector('flux-error-state button') as HTMLButtonElement).click();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('renders the idle shell as loading', () => {
    setup({ page: idleResource<AdminCategoryPage>() });
    const element = render();

    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();
  });

  it('localizes the list for the active culture', () => {
    setup({
      page: successResource<AdminCategoryPage>({
        items: [row('c1', 'Alpha')],
        totalCount: 1,
        pageNumber: 1,
        pageSize: 20,
      }),
    });
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('fr');
    try {
      const element = render();

      expect(element.querySelector('h1')?.textContent).toBe('Catégories');
      expect(element.querySelector('thead th')?.textContent?.trim()).toBe('Nom');
    } finally {
      cultures.setCulture('en');
    }
  });
});
