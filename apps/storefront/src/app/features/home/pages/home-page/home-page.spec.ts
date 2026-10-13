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

  it('links the hero action to the products shelf and shows the hero image', () => {
    const element = setup();
    const actions = [...element.querySelectorAll('.hero-actions a')].map((link) =>
      link.getAttribute('href'),
    );

    expect(actions).toEqual(['/products']);
    expect(element.querySelector('.hero-image')?.getAttribute('src')).toBe('/assets/hero.jpg');
    expect(element.querySelector('.hero-image')?.getAttribute('alt')?.length).toBeGreaterThan(0);
  });

  it('links the CTA band to shopping, orders, and the account', () => {
    const element = setup();
    const links = [...element.querySelectorAll('.cta-grid a')].map((link) =>
      link.getAttribute('href'),
    );

    expect(links).toEqual(['/products', '/account/orders', '/account/profile']);
  });

  it('renders the four store perks with icons and numerals', () => {
    const element = setup();
    const perks = [...element.querySelectorAll('.perks-grid .perk')];

    expect(element.querySelector('#perks-title')?.textContent).toBe('Why FluxCommerce');
    expect(perks).toHaveLength(4);
    expect(perks[3]?.querySelector('h3')?.textContent).toBe('5 languages');
    expect(perks[0]?.querySelector('.perk-num')?.textContent).toBe('01');
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

    expect(TestBed.inject(Title).getTitle()).toBe('Bubble up your next obsession | FluxCommerce');
    expect(metaContent('name="description"')).toBe(
      'Curated tech and lifestyle picks with honest pricing, fast checkout, and tracking from cart to door.',
    );
    expect(metaContent('property="og:title"')).toBe('Bubble up your next obsession | FluxCommerce');
    expect(metaContent('property="og:type"')).toBe('website');
    expect(metaContent('property="og:url"')).toBe('/');
    expect(metaContent('property="og:image"')).toBe(FALLBACK_SOCIAL_IMAGE);
    expect(metaContent('name="twitter:card"')).toBe('summary_large_image');
    expect(metaContent('name="twitter:title"')).toBe(
      'Bubble up your next obsession | FluxCommerce',
    );
    expect(canonicalHref()).toBe('/');
  });

  it('localizes metadata per active culture without duplicating tags', () => {
    setup('fr');

    expect(TestBed.inject(Title).getTitle()).toBe('Votre prochaine obsession | FluxCommerce');
    expect(metaContent('name="description"')).toBe(
      'Sélection tech et lifestyle, prix honnêtes et suivi jusqu’à la porte.',
    );
    expect(canonicalHref()).toBe('/');
    expect(TestBed.inject(DOCUMENT).head.querySelectorAll(CANONICAL_LINK_SELECTOR).length).toBe(1);
  });
});
