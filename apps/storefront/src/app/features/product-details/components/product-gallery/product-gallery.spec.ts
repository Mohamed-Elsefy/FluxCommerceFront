/**
 * Component tests for the `ProductGallery` (Sub-Phase 6.3 — Product Image
 * Gallery).
 *
 * Covers the presentational contract only (selection state lives here as
 * local UI state; loading lives in feature state, covered by
 * `product-details-state.spec.ts`): primary-first default selection,
 * thumbnail switching, pressed-state communication, missing/broken-URL
 * fallbacks, alt-text chains, keyboard-operable native controls, and
 * server-platform rendering without browser APIs.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { afterEach, describe, expect, it } from 'vitest';
import { CultureService } from '@flux/i18n';
import type { ProductImage } from '../../models/product-details.models';
import { ProductGallery } from './product-gallery';

const PRODUCT_ID = '11111111-1111-1111-1111-111111111111';

function image(id: string, order: number, overrides: Partial<ProductImage> = {}): ProductImage {
  return {
    id,
    productId: PRODUCT_ID,
    imageUrl: `/images/${id}.jpg`,
    altText: `View ${id}`,
    displayOrder: order,
    isPrimary: false,
    metadata: null,
    createdAtUtc: '2026-09-04T10:00:00Z',
    ...overrides,
  };
}

/** Wire order is displayOrder; the primary is deliberately NOT first. */
const IMAGES: readonly ProductImage[] = [
  image('img-1', 0),
  image('img-2', 1, { isPrimary: true }),
  image('img-3', 2),
];

function setup(options: {
  images?: readonly ProductImage[];
  productName?: string | null;
  culture?: 'en' | 'fr' | 'ar';
  platform?: 'browser' | 'server';
}): { fixture: ComponentFixture<ProductGallery>; element: HTMLElement } {
  TestBed.configureTestingModule({
    providers:
      options.platform === undefined ? [] : [{ provide: PLATFORM_ID, useValue: options.platform }],
  });
  window.localStorage.clear();
  TestBed.inject(CultureService).setCulture(options.culture ?? 'en');
  const fixture = TestBed.createComponent(ProductGallery);
  fixture.componentRef.setInput('images', options.images ?? IMAGES);
  fixture.componentRef.setInput(
    'productName',
    options.productName === undefined ? 'Tee' : options.productName,
  );
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function mainSrc(element: HTMLElement): string | null {
  return element.querySelector('.product-gallery-main-image')?.getAttribute('src') ?? null;
}

function pressedLabels(element: HTMLElement): (string | null)[] {
  return [...element.querySelectorAll('.product-gallery-thumb')].map((thumb) =>
    thumb.getAttribute('aria-label'),
  );
}

function pressedIndex(element: HTMLElement): number {
  const thumbs = [...element.querySelectorAll('.product-gallery-thumb')];
  return thumbs.findIndex((thumb) => thumb.getAttribute('aria-pressed') === 'true');
}

describe('ProductGallery selection', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('shows the primary image first even when it is not first on the wire', () => {
    const { element } = setup({});

    expect(mainSrc(element)).toBe('/images/img-2.jpg');
    expect(pressedIndex(element)).toBe(1);
  });

  it('falls back to the first image when none is primary', () => {
    const { element } = setup({ images: [image('img-1', 0), image('img-3', 2)] });

    expect(mainSrc(element)).toBe('/images/img-1.jpg');
    expect(pressedIndex(element)).toBe(0);
  });

  it('switching thumbnails updates the main image and pressed state', () => {
    const { element, fixture } = setup({});

    [...element.querySelectorAll('.product-gallery-thumb')][0]?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(mainSrc(element)).toBe('/images/img-1.jpg');
    expect(pressedIndex(element)).toBe(0);
    expect(pressedLabels(element)).toEqual([
      'View image: View img-1',
      'View image: View img-2',
      'View image: View img-3',
    ]);
  });
});

describe('ProductGallery fallbacks', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the missing-image message for an empty list', () => {
    const { element } = setup({ images: [] });

    expect(element.querySelector('.product-gallery-empty')?.textContent).toBe(
      'No images available.',
    );
    expect(element.querySelector('img')).toBeNull();
  });

  it('replaces a broken main image with the labelled fallback', () => {
    const { element, fixture } = setup({});

    element.querySelector('.product-gallery-main-image')?.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(element.querySelector('.product-gallery-main-image')).toBeNull();
    const fallback = element.querySelector('.product-gallery-fallback');
    expect(fallback?.getAttribute('role')).toBe('img');
    expect(fallback?.getAttribute('aria-label')).toBe('View img-2');
  });

  it('renders the fallback for blank URLs without emitting a request', () => {
    const { element } = setup({
      images: [image('img-1', 0, { imageUrl: '   ', isPrimary: true })],
    });

    expect(element.querySelector('.product-gallery-main-image')).toBeNull();
    expect(element.querySelector('.product-gallery-fallback')).not.toBeNull();
  });

  it('honors backend alt text, then the product name, then the generic label', () => {
    const withAlt = setup({});
    expect(withAlt.element.querySelector('.product-gallery-main-image')?.getAttribute('alt')).toBe(
      'View img-2',
    );
    TestBed.resetTestingModule();

    const withoutAlt = setup({
      images: [image('img-1', 0, { altText: null, isPrimary: true })],
      productName: 'Tee',
    });
    expect(
      withoutAlt.element.querySelector('.product-gallery-main-image')?.getAttribute('alt'),
    ).toBe('Tee');
    TestBed.resetTestingModule();

    const anonymous = setup({
      images: [image('img-1', 0, { altText: null, isPrimary: true })],
      productName: null,
    });
    expect(
      anonymous.element.querySelector('.product-gallery-main-image')?.getAttribute('alt'),
    ).toBe('Product image');
  });

  it('omits the thumbnail list for a single image', () => {
    const { element } = setup({ images: [image('img-1', 0, { isPrimary: true })] });

    expect(mainSrc(element)).toBe('/images/img-1.jpg');
    expect(element.querySelector('.product-gallery-thumbnails')).toBeNull();
  });
});

describe('ProductGallery accessibility and platform safety', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('exposes thumbnails as keyboard-operable native buttons with labels', () => {
    const { element } = setup({});
    const thumbs = [...element.querySelectorAll('.product-gallery-thumb')];

    expect(thumbs).toHaveLength(3);
    for (const thumb of thumbs) {
      expect(thumb.tagName).toBe('BUTTON');
      expect(thumb.getAttribute('type')).toBe('button');
      expect(thumb.getAttribute('aria-label')?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('renders the gallery on the server without browser APIs', () => {
    const { element } = setup({ platform: 'server' });

    expect(mainSrc(element)).toBe('/images/img-2.jpg');
    expect(element.querySelectorAll('.product-gallery-thumb')).toHaveLength(3);
  });

  it('prioritizes the above-the-fold main image and defers the rest (11.5)', () => {
    const { element } = setup({});
    const main = element.querySelector('.product-gallery-main-image');

    expect(main?.getAttribute('loading')).toBe('eager');
    expect(main?.getAttribute('fetchpriority')).toBe('high');
    expect(main?.getAttribute('decoding')).toBe('async');
    for (const thumb of element.querySelectorAll('.product-gallery-thumb img')) {
      expect(thumb.getAttribute('loading')).toBe('lazy');
      expect(thumb.getAttribute('decoding')).toBe('async');
    }
  });

  it('localizes gallery chrome for the RTL culture with identical structure', () => {
    const { element } = setup({ culture: 'ar' });

    expect(element.querySelector('.product-gallery')?.getAttribute('aria-label')).toBe(
      'صور المنتج',
    );
    expect(pressedLabels(element)).toEqual([
      'عرض الصورة: View img-1',
      'عرض الصورة: View img-2',
      'عرض الصورة: View img-3',
    ]);
    expect(element.querySelectorAll('.product-gallery-thumb')).toHaveLength(3);
  });
});
