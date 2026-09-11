/**
 * Page tests for the Sub-Phase 5.2 `CategoriesPage`.
 *
 * `CatalogState` is stubbed at its typed seam (its orchestration is
 * covered by `catalog-state.spec.ts`) so these tests own the page logic:
 * discovery load on init, loading/empty/error/success rendering, localized
 * copy per active culture, `categoryId` query-parameter selection with
 * graceful unknown ids, clear-selection navigation, and retry. The router
 * stays real to prove link-target behavior.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID, signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { of } from 'rxjs';
import {
  ApiError,
  emptyResource,
  errorResource,
  idleResource,
  loadingResource,
  successResource,
  type ResourceState,
} from '@flux/api';
import { CultureService } from '@flux/i18n';
import type { CategoryResponse } from '@flux/models';
import { CatalogState } from '../../state/catalog-state';
import type { CategoryList } from '../../models/catalog.models';
import { CategoriesPage, CATEGORY_NAV_PAGE_SIZE } from './categories-page';

const CATEGORIES: readonly CategoryResponse[] = [
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Apparel',
    slug: 'apparel',
    description: null,
    parentId: null,
    status: 0,
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Accessories',
    slug: 'accessories',
    description: null,
    parentId: null,
    status: 0,
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
  },
];

function categoryList(): CategoryList {
  return { items: [...CATEGORIES], totalCount: 2, pageNumber: 1, pageSize: 100 };
}

function setup(options: {
  snapshot?: ResourceState<CategoryList>;
  categoryId?: string | null;
  culture?: 'en' | 'fr';
  platform?: 'browser' | 'server';
}): {
  fixture: ComponentFixture<CategoriesPage>;
  element: HTMLElement;
  loadCalls: unknown[];
} {
  const loadCalls: unknown[] = [];
  const stateStub = {
    categories: signal(options.snapshot ?? idleResource<CategoryList>()),
    loadCategories: ((query: unknown) => {
      loadCalls.push(query);
    }) as CatalogState['loadCategories'],
  } as unknown as CatalogState;
  const routeStub = {
    queryParamMap: of(
      convertToParamMap({
        ...(options.categoryId === undefined ? {} : { categoryId: options.categoryId }),
      }),
    ),
  } as unknown as ActivatedRoute;

  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CatalogState, useValue: stateStub },
      { provide: ActivatedRoute, useValue: routeStub },
      ...(options.platform === undefined
        ? []
        : [{ provide: PLATFORM_ID, useValue: options.platform }]),
    ],
  });
  window.localStorage.clear();
  TestBed.inject(CultureService).setCulture(options.culture ?? 'en');
  const fixture = TestBed.createComponent(CategoriesPage);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement, loadCalls };
}

function categoryLinks(element: HTMLElement): HTMLAnchorElement[] {
  return [...element.querySelectorAll('catalog-category-nav nav a')].map(
    (link) => link as HTMLAnchorElement,
  );
}

describe('CategoriesPage loading', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads the full discovery set on init', () => {
    const { loadCalls } = setup({});

    expect(loadCalls).toEqual([{ pageNumber: 1, pageSize: CATEGORY_NAV_PAGE_SIZE }]);
  });

  it('skips loading on the server (prerenders the idle shell)', () => {
    const { element, loadCalls } = setup({ platform: 'server' });

    expect(loadCalls).toEqual([]);
    expect(element.querySelector('flux-loading-indicator')).toBeNull();
    expect(element.querySelector('h1')?.textContent).toBe('Shop by category');
  });

  it('renders the loading state while categories fetch', () => {
    const { element } = setup({ snapshot: loadingResource<CategoryList>() });

    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();
    expect(element.querySelector('catalog-category-nav')).toBeNull();
  });
});

describe('CategoriesPage success', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders one listing link per category', () => {
    const { element } = setup({ snapshot: successResource(categoryList()) });

    expect(categoryLinks(element).map((link) => link.getAttribute('href'))).toEqual([
      '/catalog?categoryId=22222222-2222-2222-2222-222222222222',
      '/catalog?categoryId=33333333-3333-3333-3333-333333333333',
    ]);
  });

  it('marks the query-selected category and offers to clear it', () => {
    const { element } = setup({
      snapshot: successResource(categoryList()),
      categoryId: CATEGORIES[1]?.id ?? null,
    });
    const clear = element.querySelector('.categories-page > p a');

    expect(categoryLinks(element)[1]?.getAttribute('aria-current')).toBe('page');
    expect(categoryLinks(element)[0]?.getAttribute('aria-current')).toBeNull();
    expect(clear?.getAttribute('href')).toBe('/catalog');
    expect(clear?.textContent?.trim()).toBe('Show all categories');
  });

  it('selects nothing for an unknown category id', () => {
    const { element } = setup({
      snapshot: successResource(categoryList()),
      categoryId: 'unknown-category',
    });

    for (const link of categoryLinks(element)) {
      expect(link.getAttribute('aria-current')).toBeNull();
    }
  });

  it('renders localized copy for the active culture', () => {
    const { element } = setup({ snapshot: successResource(categoryList()) });
    expect(element.querySelector('h1')?.textContent).toBe('Shop by category');

    TestBed.resetTestingModule();
    const french = setup({ snapshot: successResource(categoryList()), culture: 'fr' });

    expect(french.element.querySelector('h1')?.textContent).toBe('Acheter par catégorie');
    expect(french.element.querySelector('catalog-category-nav')).not.toBeNull();
  });
});

describe('CategoriesPage empty and error', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the localized empty state when no categories exist', () => {
    const { element } = setup({ snapshot: emptyResource<CategoryList>(categoryList()) });
    const empty = element.querySelector('flux-empty-state');

    expect(empty?.querySelector('.title')?.textContent).toBe('No categories yet');
    expect(empty?.querySelector('.message')?.textContent).toBe(
      'Check back soon — new categories are on the way.',
    );
    expect(element.querySelector('catalog-category-nav')).toBeNull();
  });

  it('renders the localized error state with retry', () => {
    const { fixture, element, loadCalls } = setup({
      snapshot: errorResource<CategoryList>(
        new ApiError({ status: 500, message: 'Server error.' }),
      ),
    });
    const error = element.querySelector('flux-error-state');

    expect(error).not.toBeNull();
    expect(error?.querySelector('.title')?.textContent).toBe('Categories unavailable');
    expect(error?.querySelector('.message')?.textContent).toBe('An unexpected error occurred.');
    expect(error?.querySelector('button.retry')).not.toBeNull();

    (error?.querySelector('button.retry') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(loadCalls).toHaveLength(2);
  });
});
