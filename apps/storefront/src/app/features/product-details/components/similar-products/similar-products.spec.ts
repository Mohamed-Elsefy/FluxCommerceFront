/**
 * Component tests for the product-details `SimilarProducts` rail.
 *
 * Covers the presentational contract only: one Pod mini-card per product
 * (image honoring backend `altText`, imageless fallback, name, details
 * link) plus the "show more" entry into the category-filtered shelf.
 * No prices render (variants own pricing), no availability renders (the
 * contract exposes none) — the rail never fabricates either.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import type { SimilarProduct } from '../../models/product-details.models';
import { SimilarProducts } from './similar-products';

const CATEGORY_ID = '22222222-2222-2222-2222-222222222222';

function item(id: string, name: string, imageUrl: string | null): SimilarProduct {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    description: null,
    seo: null,
    status: 1,
    visibility: 0,
    categoryId: CATEGORY_ID,
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
    primaryImage:
      imageUrl === null
        ? null
        : {
            id: `img-${id}`,
            imageUrl,
            altText: `${name} front view`,
            displayOrder: 0,
            isPrimary: true,
          },
  };
}

const PRODUCTS: readonly SimilarProduct[] = [
  item('55555555-5555-5555-5555-555555555555', 'Hoodie', '/cdn/hoodie.jpg'),
  item('66666666-6666-6666-6666-666666666666', 'Cap', null),
];

function setup(): { fixture: ComponentFixture<SimilarProducts>; element: HTMLElement } {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(SimilarProducts);
  fixture.componentRef.setInput('products', PRODUCTS);
  fixture.componentRef.setInput('categoryId', CATEGORY_ID);
  fixture.componentRef.setInput('label', 'Similar products');
  fixture.componentRef.setInput('linkLabel', 'Show more');
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('SimilarProducts', () => {
  it('renders one mini-card per product with details links', () => {
    const { element } = setup();
    const cards = [...element.querySelectorAll('.similar-products-card')];

    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.querySelector('h3')?.textContent)).toEqual(['Hoodie', 'Cap']);
    expect(
      [...element.querySelectorAll('.similar-products-card a')].map((link) =>
        link.getAttribute('href'),
      ),
    ).toEqual([
      '/catalog/products/55555555-5555-5555-5555-555555555555',
      '/catalog/products/66666666-6666-6666-6666-666666666666',
    ]);
  });

  it('renders the image honoring backend alt text with a fallback for imageless items', () => {
    const { element } = setup();
    const images = [...element.querySelectorAll('.similar-products-image')];

    expect(images).toHaveLength(1);
    expect(images[0]?.getAttribute('src')).toBe('/cdn/hoodie.jpg');
    expect(images[0]?.getAttribute('alt')).toBe('Hoodie front view');
    expect(element.querySelectorAll('.similar-products-fallback')).toHaveLength(1);
  });

  it('links show-more into the category-filtered shelf', () => {
    const { element } = setup();
    const more = element.querySelector('.similar-products-more a');

    expect(more?.textContent?.trim()).toBe('Show more');
    expect(more?.getAttribute('href')).toBe(`/products?categoryId=${CATEGORY_ID}`);
  });

  it('exposes no prices or availability affordances', () => {
    const { element } = setup();
    const text = (element.textContent ?? '').toLowerCase();

    expect(element.querySelectorAll('button').length).toBe(0);
    for (const word of ['price', '$', '€', 'stock']) {
      expect(text).not.toContain(word);
    }
  });
});
