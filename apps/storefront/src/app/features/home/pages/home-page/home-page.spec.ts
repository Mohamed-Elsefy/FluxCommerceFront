import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { provideRouter } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { describe, expect, it } from 'vitest';
import { CultureService } from '@flux/i18n';
import { CANONICAL_LINK_SELECTOR, FALLBACK_SOCIAL_IMAGE } from '@flux/utils';
import { HomePage } from './home-page';

function setup(culture: 'en' | 'fr' | 'ar' = 'en'): HTMLElement {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  window.localStorage.clear();
  TestBed.inject(CultureService).setCulture(culture);
  const fixture = TestBed.createComponent(HomePage);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('HomePage', () => {
  it('renders the placeholder heading', () => {
    expect(setup().querySelector('h1')?.textContent).toContain('Storefront');
  });

  it('links the discovery entry point to the catalog feature', () => {
    const entry = setup().querySelector('section[aria-labelledby="discovery-title"] a');

    expect(entry?.getAttribute('href')).toBe('/catalog');
    expect(entry?.textContent?.trim()).toBe('Browse categories');
  });

  it('localizes the discovery entry per active culture', () => {
    const french = setup('fr');
    expect(french.querySelector('#discovery-title')?.textContent).toBe('Découvrir des produits');
    expect(
      french.querySelector('section[aria-labelledby="discovery-title"] a')?.textContent?.trim(),
    ).toBe('Parcourir les catégories');

    TestBed.resetTestingModule();
    const arabic = setup('ar');
    expect(arabic.querySelector('#discovery-title')?.textContent).toBe('اكتشف المنتجات');
    expect(
      arabic.querySelector('section[aria-labelledby="discovery-title"] a')?.textContent?.trim(),
    ).toBe('تصفح الفئات');
  });

  it('links the cart entry point to the cart feature', () => {
    const entry = setup().querySelector('section[aria-labelledby="cart-title"] a');

    expect(entry?.getAttribute('href')).toBe('/cart');
    expect(entry?.textContent?.trim()).toBe('View your cart');
  });

  it('localizes the cart entry per active culture', () => {
    const french = setup('fr');
    expect(french.querySelector('#cart-title')?.textContent).toBe('Votre panier');
    expect(
      french.querySelector('section[aria-labelledby="cart-title"] a')?.textContent?.trim(),
    ).toBe('Voir votre panier');

    TestBed.resetTestingModule();
    const arabic = setup('ar');
    expect(arabic.querySelector('#cart-title')?.textContent).toBe('سلة التسوق');
    expect(
      arabic.querySelector('section[aria-labelledby="cart-title"] a')?.textContent?.trim(),
    ).toBe('عرض سلة التسوق');
  });
});

describe('HomePage metadata (11.3 SEO)', () => {
  function metaContent(selector: string): string | null {
    return TestBed.inject(Meta).getTag(selector)?.getAttribute('content') ?? null;
  }

  function canonicalHref(): string | null {
    return (
      TestBed.inject(DOCUMENT).head.querySelector(CANONICAL_LINK_SELECTOR)?.getAttribute('href') ??
      null
    );
  }

  it('sets the home title, description, and canonical on init', () => {
    setup();

    expect(TestBed.inject(Title).getTitle()).toBe('Discover products | FluxCommerce');
    expect(metaContent('name="description"')).toBe('Browse the catalog through its categories.');
    expect(metaContent('property="og:title"')).toBe('Discover products | FluxCommerce');
    expect(metaContent('property="og:type"')).toBe('website');
    expect(metaContent('property="og:url"')).toBe('/');
    expect(metaContent('property="og:image"')).toBe(FALLBACK_SOCIAL_IMAGE);
    expect(metaContent('name="twitter:card"')).toBe('summary_large_image');
    expect(metaContent('name="twitter:title"')).toBe('Discover products | FluxCommerce');
    expect(canonicalHref()).toBe('/');
  });

  it('localizes metadata per active culture without duplicating tags', () => {
    setup('fr');

    expect(TestBed.inject(Title).getTitle()).toBe('Découvrir des produits | FluxCommerce');
    expect(metaContent('name="description"')).toBe('Parcourez le catalogue par catégories.');
    expect(canonicalHref()).toBe('/');
    expect(TestBed.inject(DOCUMENT).head.querySelectorAll(CANONICAL_LINK_SELECTOR).length).toBe(1);
  });
});
