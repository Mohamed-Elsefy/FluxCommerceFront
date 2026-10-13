/**
 * Component tests for the Sub-Phase 5.3 `ProductCard`.
 *
 * Covers the presentational contract only: name, primary image (honoring
 * backend `altText`), imageless fallback, and the future Product Details
 * link (`/catalog/products/<id>`). Asserts the contract-strict boundary
 * too — no price, availability, variant, quantity, or cart affordances
 * exist on the card. The router stays real to prove link-target behavior.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { ProductStatus } from '@flux/models';
import type { ProductListItem } from '../../models/catalog.models';
import { ProductCard } from './product-card';

const PRODUCT: ProductListItem = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Tee',
  slug: 'tee',
  description: null,
  categoryId: '22222222-2222-2222-2222-222222222222',
  primaryImage: {
    id: '44444444-4444-4444-4444-444444444444',
    imageUrl: '/cdn/tee.jpg',
    altText: 'Tee front view',
    displayOrder: 0,
    isPrimary: true,
  },
};

function setup(
  product: ProductListItem,
  status?: { status: ProductStatus; statusLabel: string },
): {
  fixture: ComponentFixture<ProductCard>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(ProductCard);
  fixture.componentRef.setInput('product', product);
  if (status !== undefined) {
    fixture.componentRef.setInput('status', status.status);
    fixture.componentRef.setInput('statusLabel', status.statusLabel);
  }
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('ProductCard', () => {
  it('renders the product name', () => {
    const { element } = setup(PRODUCT);

    expect(element.querySelector('h3')?.textContent).toBe('Tee');
  });

  it('renders the primary image honoring backend alt text', () => {
    const { element } = setup(PRODUCT);
    const image = element.querySelector('img');

    expect(image?.getAttribute('src')).toBe('/cdn/tee.jpg');
    expect(image?.getAttribute('alt')).toBe('Tee front view');
    expect(image?.getAttribute('loading')).toBe('lazy');
    expect(image?.getAttribute('decoding')).toBe('async');
  });

  it('renders an imageless fallback without inventing image content', () => {
    const { element } = setup({ ...PRODUCT, primaryImage: null });

    expect(element.querySelector('img')).toBeNull();
    expect(element.querySelector('.product-image-fallback')).not.toBeNull();
    expect(element.querySelector('h3')?.textContent).toBe('Tee');
  });

  it('swaps a broken image to the reserved-space fallback (11.5)', () => {
    const { fixture, element } = setup(PRODUCT);

    expect(element.querySelector('img')).not.toBeNull();
    element.querySelector('img')?.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(element.querySelector('img')).toBeNull();
    expect(element.querySelector('.product-image-fallback')).not.toBeNull();
    expect(element.querySelector('h3')?.textContent).toBe('Tee');
  });

  it('links to the future Product Details route', () => {
    const { element } = setup(PRODUCT);

    expect(element.querySelector('a')?.getAttribute('href')).toBe(
      '/catalog/products/11111111-1111-1111-1111-111111111111',
    );
  });

  it('exposes no price, availability, variant, quantity, or cart affordances', () => {
    const { element } = setup(PRODUCT);
    const text = (element.textContent ?? '').toLowerCase();

    expect(element.querySelectorAll('button').length).toBe(0);
    expect(element.querySelectorAll('input,select').length).toBe(0);
    for (const word of ['price', '$', '€', 'stock', 'variant', 'quantity', 'cart', 'sku']) {
      expect(text).not.toContain(word);
    }
  });

  it('renders the backend status sticker for non-active products', () => {
    const { element } = setup(PRODUCT, { status: ProductStatus.Draft, statusLabel: 'Draft' });

    expect(element.querySelector('.sticker flux-badge')?.textContent?.trim()).toBe('Draft');
  });

  it('hides the status sticker for active or unknown status', () => {
    const active = setup(PRODUCT, { status: ProductStatus.Active, statusLabel: 'Active' });
    expect(active.element.querySelector('.sticker flux-badge')?.textContent?.trim()).toBe('New');

    TestBed.resetTestingModule();
    const unknown = setup(PRODUCT);
    expect(unknown.element.querySelector('.sticker flux-badge')?.textContent?.trim()).toBe('New');
  });
});
