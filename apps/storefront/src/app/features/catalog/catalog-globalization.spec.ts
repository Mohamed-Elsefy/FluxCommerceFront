/**
 * Globalization tests for Sub-Phase 5.9 — Localization, RTL & Responsive.
 *
 * Two invariants, no backend and no router navigation:
 *
 * 1. Direction-structure invariance: every catalog presentational
 *    component renders byte-identical markup under `ltr` and `rtl`
 *    document directions. Components must never branch on direction (CSS
 *    logical properties, owned by the audit script, do the mirroring) —
 *    these tests lock the DOM side of that contract, covering grid,
 *    filters, search, pagination, and navigation.
 * 2. Five-culture rendering: the catalog page header and search entry
 *    resolve to the expected copy in `en`/`fr`/`de`/`es`/`ar`, and the
 *    culture switch drives the root `dir` (`ar` → `rtl`) through the
 *    Phase 4 mechanism the page consumes.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { of } from 'rxjs';
import { idleResource } from '@flux/api';
import { CultureService } from '@flux/i18n';
import { CatalogState } from './state/catalog-state';
import type { CategoryList, ProductList, ProductListItem } from './models/catalog.models';
import { CategoriesPage } from './pages/categories/categories-page';
import { CategoryNav } from './components/category-nav/category-nav';
import { FilterSelect } from './components/filter-select/filter-select';
import { ProductGrid } from './components/product-grid/product-grid';
import { ProductPagination } from './components/product-pagination/product-pagination';
import { SearchInput } from './components/search-input/search-input';

const CATEGORY_ID = '22222222-2222-2222-2222-222222222222';

const PRODUCT: ProductListItem = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Tee',
  slug: 'tee',
  description: null,
  categoryId: CATEGORY_ID,
  primaryImage: null,
};

/** Renders a component under a document direction and returns its markup. */
function renderUnder<T>(
  create: () => ComponentFixture<T>,
  direction: 'ltr' | 'rtl',
): { element: HTMLElement; markup: string } {
  TestBed.resetTestingModule();
  document.documentElement.setAttribute('dir', direction);
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = create();
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  return { element, markup: element.innerHTML.replace(/>\s+</g, '><').trim() };
}

describe('catalog direction-structure invariance (5.9 RTL)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    document.documentElement.setAttribute('dir', 'ltr');
  });

  it('renders the category navigation identically in both directions', () => {
    const seed = (): ComponentFixture<CategoryNav> => {
      const fixture = TestBed.createComponent(CategoryNav);
      fixture.componentRef.setInput('categories', [
        {
          id: CATEGORY_ID,
          name: 'Apparel',
          slug: 'apparel',
          description: 'Wearables.',
          parentId: null,
          status: 0,
          isDeleted: false,
          createdAtUtc: '2026-09-04T10:00:00Z',
          deletedAtUtc: null,
        },
      ]);
      fixture.componentRef.setInput('activeCategoryId', CATEGORY_ID);
      fixture.componentRef.setInput('label', 'Categories');
      return fixture;
    };

    const ltr = renderUnder(seed, 'ltr');
    const rtl = renderUnder(seed, 'rtl');

    expect(rtl.markup).toBe(ltr.markup);
    expect(rtl.markup).not.toContain(' dir=');
  });

  it('renders the product grid identically in both directions', () => {
    const seed = (): ComponentFixture<ProductGrid> => {
      const fixture = TestBed.createComponent(ProductGrid);
      fixture.componentRef.setInput('products', [PRODUCT]);
      return fixture;
    };

    const ltr = renderUnder(seed, 'ltr');
    const rtl = renderUnder(seed, 'rtl');

    expect(rtl.markup).toBe(ltr.markup);
    expect(rtl.markup).not.toContain(' dir=');
  });

  it('renders pagination identically in both directions', () => {
    const seed = (): ComponentFixture<ProductPagination> => {
      const fixture = TestBed.createComponent(ProductPagination);
      fixture.componentRef.setInput('page', 2);
      fixture.componentRef.setInput('pageSize', 20);
      fixture.componentRef.setInput('totalCount', 45);
      fixture.componentRef.setInput('copy', {
        label: 'Product pages',
        first: 'First',
        previous: 'Previous',
        next: 'Next',
        last: 'Last',
      });
      return fixture;
    };

    const ltr = renderUnder(seed, 'ltr');
    const rtl = renderUnder(seed, 'rtl');

    expect(rtl.markup).toBe(ltr.markup);
    expect(rtl.markup).not.toContain(' dir=');
  });

  it('renders search and filter inputs identically in both directions', () => {
    const search = (): ComponentFixture<SearchInput> => {
      const fixture = TestBed.createComponent(SearchInput);
      fixture.componentRef.setInput('value', 'tee');
      fixture.componentRef.setInput('label', 'Search products');
      fixture.componentRef.setInput('placeholder', 'Search by keyword…');
      return fixture;
    };
    const filter = (): ComponentFixture<FilterSelect> => {
      const fixture = TestBed.createComponent(FilterSelect);
      fixture.componentRef.setInput('label', 'Status');
      fixture.componentRef.setInput('options', [
        { value: '', label: 'All' },
        { value: '1', label: 'Active' },
      ]);
      fixture.componentRef.setInput('value', '1');
      return fixture;
    };

    expect(renderUnder(search, 'rtl').markup).toBe(renderUnder(search, 'ltr').markup);
    expect(renderUnder(filter, 'rtl').markup).toBe(renderUnder(filter, 'ltr').markup);
  });
});

describe('catalog five-culture rendering (5.9 localization)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    document.documentElement.setAttribute('dir', 'ltr');
  });

  const EXPECTED: Record<string, { title: string; search: string; direction: string }> = {
    en: { title: 'Shop by category', search: 'Search products', direction: 'ltr' },
    fr: { title: 'Acheter par catégorie', search: 'Rechercher des produits', direction: 'ltr' },
    de: { title: 'Nach Kategorie stöbern', search: 'Produkte suchen', direction: 'ltr' },
    es: { title: 'Comprar por categoría', search: 'Buscar productos', direction: 'ltr' },
    ar: { title: 'تسوّق حسب الفئة', search: 'البحث في المنتجات', direction: 'rtl' },
  };

  it('resolves page copy and root direction per culture', () => {
    for (const [culture, expected] of Object.entries(EXPECTED)) {
      TestBed.resetTestingModule();
      const stateStub = {
        categories: signal(idleResource<CategoryList>()),
        products: signal(idleResource<ProductList>()),
        loadCategories: (() => undefined) as unknown as CatalogState['loadCategories'],
        loadProducts: (() => undefined) as unknown as CatalogState['loadProducts'],
        clearProducts: (() => undefined) as unknown as CatalogState['clearProducts'],
      } as unknown as CatalogState;
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          { provide: CatalogState, useValue: stateStub },
          {
            provide: ActivatedRoute,
            useValue: { queryParamMap: of(convertToParamMap({})) },
          },
        ],
      });
      window.localStorage.clear();
      TestBed.inject(CultureService).setCulture(culture as 'en' | 'fr' | 'de' | 'es' | 'ar');
      const fixture = TestBed.createComponent(CategoriesPage);
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;

      expect(element.querySelector('h1')?.textContent, culture).toBe(expected.title);
      expect(
        element.querySelector('catalog-search-input .search-label')?.textContent,
        culture,
      ).toBe(expected.search);
      expect(document.documentElement.getAttribute('dir'), culture).toBe(expected.direction);
    }
    TestBed.inject(CultureService).setCulture('en');
  });
});
