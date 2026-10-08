import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { provideApi, provideAppEnvironment } from '@flux/api';
import { provideAuthRecovery } from '@flux/auth';
import { CultureService } from '@flux/i18n';
import { ThemeService } from '@flux/theming';
import { StorefrontHeader } from './header';

function setup(): { fixture: ComponentFixture<StorefrontHeader>; element: HTMLElement } {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideAppEnvironment({
        name: 'development',
        production: false,
        appName: 'test',
        apiBaseUrl: '/api',
      }),
      provideApi(),
      provideAuthRecovery(),
      provideHttpClientTesting(),
    ],
  });
  window.localStorage.clear();
  const fixture = TestBed.createComponent(StorefrontHeader);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('StorefrontHeader', () => {
  it('renders the brand, desktop navigation, and auth entry points', () => {
    const { element } = setup();

    expect(element.querySelector('.brand')?.getAttribute('href')).toBe('/');
    const desktopLinks = [...element.querySelectorAll('.desktop-nav .nav a')].map((link) =>
      link.textContent?.trim(),
    );
    expect(desktopLinks).toEqual(['Home', 'Catalog']);
    expect(element.querySelector('auth-nav')).not.toBeNull();
  });

  it('exposes the cart quick-access link to the existing cart route', () => {
    const { element } = setup();
    const cart = element.querySelector('a.cart-link');

    expect(cart?.getAttribute('href')).toBe('/cart');
    expect(cart?.textContent?.trim()).toBe('Cart');
  });

  it('wires the language picker to the central culture state', () => {
    const { fixture, element } = setup();
    const cultures = TestBed.inject(CultureService);
    const select = element.querySelector('storefront-culture-switch select') as HTMLSelectElement;

    expect(select.value).toBe('en');
    expect(select.querySelectorAll('option')).toHaveLength(5);

    select.value = 'ar';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(cultures.culture()).toBe('ar');
    cultures.setCulture('en');
  });

  it('localizes navigation destinations and chrome per active culture', () => {
    const { fixture, element } = setup();
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('fr');
    try {
      fixture.detectChanges();
      const desktopLinks = [...element.querySelectorAll('.desktop-nav .nav a')].map((link) =>
        link.textContent?.trim(),
      );

      expect(desktopLinks).toEqual(['Accueil', 'Catalogue']);
      expect(element.querySelector('a.cart-link')?.textContent?.trim()).toBe('Panier');
      expect(element.querySelector('.brand')?.getAttribute('aria-label')).toBe(
        'FluxCommerce accueil',
      );
      expect(element.querySelector('button.menu-toggle')?.getAttribute('aria-label')).toBe(
        'Basculer la navigation',
      );
    } finally {
      cultures.setCulture('en');
    }
  });

  it('toggles the mobile navigation panel with accessible state', () => {
    const { fixture, element } = setup();
    const toggle = element.querySelector('button.menu-toggle') as HTMLButtonElement;

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe('storefront-mobile-nav');
    expect(element.querySelector('#storefront-mobile-nav')).toBeNull();

    toggle.click();
    fixture.detectChanges();

    const updated = element.querySelector('#storefront-mobile-nav');
    expect(updated).not.toBeNull();
    expect(updated?.querySelector('.nav')?.getAttribute('data-orientation')).toBe('vertical');
    expect(element.querySelector('button.menu-toggle')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('offers cart and language quick access inside the mobile panel', () => {
    const { fixture, element } = setup();

    (element.querySelector('button.menu-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    const panel = element.querySelector('.mobile-panel');
    expect(panel?.querySelector('a.cart-link')?.getAttribute('href')).toBe('/cart');
    expect(
      panel?.querySelector('storefront-culture-switch select option')?.textContent?.trim(),
    ).toBe('English');
  });

  it('dismisses the mobile panel on Escape and returns focus to the toggle', () => {
    const { fixture, element } = setup();

    (element.querySelector('button.menu-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(element.querySelector('#storefront-mobile-nav')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(element.querySelector('#storefront-mobile-nav')).toBeNull();
    expect(document.activeElement).toBe(element.querySelector('button.menu-toggle'));
  });

  it('wires the shared theme toggle to the central theme state', () => {
    const { fixture, element } = setup();
    const themes = TestBed.inject(ThemeService);

    expect(themes.theme()).toBe('dark');
    expect(
      element.querySelector('flux-theme-toggle button.toggle')?.getAttribute('aria-label'),
    ).toBe('Switch to light theme');

    (element.querySelector('flux-theme-toggle button.toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(themes.theme()).toBe('light');
    expect(
      element.querySelector('flux-theme-toggle button.toggle')?.getAttribute('aria-label'),
    ).toBe('Switch to dark theme');
  });
});
