import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { CultureService } from '@flux/i18n';
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
