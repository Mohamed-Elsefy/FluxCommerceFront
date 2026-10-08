import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID, signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { of } from 'rxjs';
import { idleResource, type ResourceState } from '@flux/api';
import { CultureService } from '@flux/i18n';
import { CatalogState } from '../../state/catalog-state';
import type { CategoryList, ProductList } from '../../models/catalog.models';
import { ProductsPage } from './products-page';

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
    expect(element.querySelector('catalog-search-input')).not.toBeNull();
  });

  it('localizes the shelf title per active culture', () => {
    const { element } = setup({ culture: 'fr' });

    expect(element.querySelector('#products-title')?.textContent).toBe('Produits');
  });
});
