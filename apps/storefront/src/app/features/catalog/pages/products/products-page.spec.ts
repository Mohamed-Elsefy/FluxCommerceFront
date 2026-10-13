import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID, signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { idleResource, successResource, type ResourceState } from '@flux/api';
import { CultureService } from '@flux/i18n';
import { CatalogState } from '../../state/catalog-state';
import type { CategoryList, ProductList } from '../../models/catalog.models';
import { ProductsPage } from './products-page';

const CATEGORIES: CategoryList = {
  items: [
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
  ],
  totalCount: 1,
  pageNumber: 1,
  pageSize: 12,
};

function setup(
  options: {
    snapshot?: ResourceState<CategoryList>;
    productsSnapshot?: ResourceState<ProductList>;
    routeQuery?: Record<string, string>;
    culture?: 'en' | 'fr';
  } = {},
): { fixture: ComponentFixture<ProductsPage>; element: HTMLElement } {
  const stateStub = {
    categories: signal(options.snapshot ?? idleResource<CategoryList>()),
    products: signal(options.productsSnapshot ?? idleResource<ProductList>()),
    loadCategories: (() => undefined) as unknown as CatalogState['loadCategories'],
    loadProducts: (() => undefined) as unknown as CatalogState['loadProducts'],
    clearProducts: (() => undefined) as unknown as CatalogState['clearProducts'],
  } as unknown as CatalogState;
  const routeStub = {
    queryParamMap: of(convertToParamMap({ ...(options.routeQuery ?? {}) })),
  } as unknown as ActivatedRoute;

  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CatalogState, useValue: stateStub },
      { provide: ActivatedRoute, useValue: routeStub },
      { provide: PLATFORM_ID, useValue: 'server' },
    ],
  });
  window.localStorage.clear();
  TestBed.inject(CultureService).setCulture(options.culture ?? 'en');
  const fixture = TestBed.createComponent(ProductsPage);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('ProductsPage', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    window.localStorage.clear();
  });

  it('renders the shelf title and search field', () => {
    const { element } = setup();

    expect(element.querySelector('#products-title')?.textContent).toBe('Products');
  });

  it('localizes the shelf title per active culture', () => {
    const { element } = setup({ culture: 'fr' });

    expect(element.querySelector('#products-title')?.textContent).toBe('Produits');
  });

  it('renders no search box (search lives in the header)', () => {
    const { element } = setup({ snapshot: successResource(CATEGORIES) });

    expect(element.querySelector('catalog-search-input')).toBeNull();
  });

  it('renders the category strip with an All chip and one chip per category', () => {
    const { element } = setup({ snapshot: successResource(CATEGORIES) });
    const chips = [...element.querySelectorAll('.strip flux-chip button.chip')];

    expect(chips.map((chip) => chip.textContent?.trim())).toEqual(['All', 'Apparel']);
    expect(chips[0]?.getAttribute('data-selected')).toBe('true');
  });

  it('marks the active strip category from the route', () => {
    const { element } = setup({
      snapshot: successResource(CATEGORIES),
      routeQuery: { categoryId: '22222222-2222-2222-2222-222222222222' },
    });
    const chips = [...element.querySelectorAll('.strip flux-chip button.chip')];

    expect(chips[0]?.getAttribute('data-selected')).toBe('false');
    expect(chips[1]?.getAttribute('data-selected')).toBe('true');
  });

  it('offers the page-size control with contract-max choices', () => {
    const { element } = setup({ snapshot: successResource(CATEGORIES) });
    const selector = [...element.querySelectorAll('catalog-filter-select')].find(
      (select) => select.querySelector('.filter-label')?.textContent === 'Per page',
    );
    const options = [...(selector?.querySelectorAll('option') ?? [])].map(
      (option) => option.textContent,
    );

    expect(options).toEqual(['12', '24', '48']);
  });

  it('commits strip category selection to the listing URL', () => {
    const { element } = setup({ snapshot: successResource(CATEGORIES) });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const chips = [...element.querySelectorAll('.strip flux-chip button.chip')];

    (chips[1] as HTMLButtonElement).click();

    expect(navigate).toHaveBeenCalledWith(
      ['/products'],
      expect.objectContaining({
        queryParams: expect.objectContaining({
          categoryId: '22222222-2222-2222-2222-222222222222',
        }),
      }),
    );
  });
});
