/**
 * Component tests for the Sub-Phase 5.3 `ProductGrid`.
 *
 * Covers the presentational contract only: one reusable card per product
 * in backend order, list semantics for assistive technology, and an empty
 * list rendering no cards (emptiness copy stays with the owning page).
 * The router stays real to prove card link-target behavior end to end.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { ProductStatus } from '@flux/models';
import type { ProductCardItem, ProductListItem } from '../../models/catalog.models';
import { ProductGrid } from './product-grid';

function item(id: string, name: string): ProductListItem {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    description: null,
    categoryId: '22222222-2222-2222-2222-222222222222',
    primaryImage: null,
  };
}

const PRODUCTS: readonly ProductListItem[] = [
  item('11111111-1111-1111-1111-111111111111', 'Tee'),
  item('55555555-5555-5555-5555-555555555555', 'Hoodie'),
];

function setup(products: readonly ProductListItem[]): {
  fixture: ComponentFixture<ProductGrid>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(ProductGrid);
  fixture.componentRef.setInput('products', products);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('ProductGrid', () => {
  it('renders one reusable card per product in order', () => {
    const { element } = setup(PRODUCTS);
    const cards = [...element.querySelectorAll('catalog-product-card')];

    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.querySelector('h3')?.textContent)).toEqual(['Tee', 'Hoodie']);
  });

  it('keeps list semantics for the result set', () => {
    const { element } = setup(PRODUCTS);

    expect(element.querySelector('ul.product-grid')).not.toBeNull();
    expect(element.querySelectorAll('ul.product-grid > li')).toHaveLength(2);
  });

  it('renders card links to the future Product Details route', () => {
    const { element } = setup(PRODUCTS);

    expect(
      [...element.querySelectorAll('catalog-product-card a')].map((link) =>
        link.getAttribute('href'),
      ),
    ).toEqual([
      '/catalog/products/11111111-1111-1111-1111-111111111111',
      '/catalog/products/55555555-5555-5555-5555-555555555555',
    ]);
  });

  it('renders no cards for an empty result', () => {
    const { element } = setup([]);

    expect(element.querySelector('ul.product-grid')).not.toBeNull();
    expect(element.querySelector('catalog-product-card')).toBeNull();
  });

  it('renders as a horizontal rail on demand without changing order', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ProductGrid);
    fixture.componentRef.setInput('products', PRODUCTS);
    fixture.componentRef.setInput('layout', 'rail');
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const rail = element.querySelector('ul.product-grid');

    expect(rail?.getAttribute('data-layout')).toBe('rail');
    expect(
      [...element.querySelectorAll('catalog-product-card h3')].map((card) => card.textContent),
    ).toEqual(['Tee', 'Hoodie']);
  });

  it('forwards backend status stickers with page-localized labels', () => {
    const items: readonly ProductCardItem[] = [
      {
        ...item('11111111-1111-1111-1111-111111111111', 'Tee'),
        status: ProductStatus.Draft,
      },
    ];
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ProductGrid);
    fixture.componentRef.setInput('products', items);
    fixture.componentRef.setInput('statusLabels', { [ProductStatus.Draft]: 'Draft' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.sticker flux-badge')?.textContent?.trim()).toBe(
      'Draft',
    );
  });
});
