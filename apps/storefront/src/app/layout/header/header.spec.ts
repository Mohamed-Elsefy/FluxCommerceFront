import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { provideApi, provideAppEnvironment } from '@flux/api';
import { AuthService, provideAuthRecovery, type CurrentUser } from '@flux/auth';
import { CultureService } from '@flux/i18n';
import { ThemeService } from '@flux/theming';
import { StorefrontHeader } from './header';

const USER: CurrentUser = {
  id: 'cccccccc-3333-4333-8333-333333333333',
  email: 'ada@flux.local',
  displayName: 'Ada Lovelace',
  roles: ['Customer'],
  permissions: [],
  isEmailVerified: true,
};

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
    expect(desktopLinks).toEqual(['Home', 'Products', 'Cart']);
    expect(element.querySelector('a.login-pill')).not.toBeNull();
  });

  it('exposes the cart destination alongside the other links', () => {
    const { element } = setup();
    const cart = [...element.querySelectorAll('.desktop-nav .nav a')].find(
      (link) => link.getAttribute('href') === '/cart',
    );

    expect(cart?.textContent?.trim()).toBe('Cart');
    expect(element.querySelector('a.cart-link')).toBeNull();
  });

  it('cycles the language pill to the next supported culture', () => {
    const { fixture, element } = setup();
    const cultures = TestBed.inject(CultureService);
    const pill = element.querySelector('button.lang-button') as HTMLButtonElement;

    expect(pill?.textContent).toContain('English');

    pill.click();
    fixture.detectChanges();

    expect(cultures.culture()).toBe('fr');
    expect(element.querySelector('button.lang-button')?.textContent).toContain('Français');
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

      expect(desktopLinks).toEqual(['Accueil', 'Produits', 'Panier']);
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

  it('offers navigation, search, and language access inside the mobile panel', () => {
    const { fixture, element } = setup();

    (element.querySelector('button.menu-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    const panel = element.querySelector('.mobile-panel');
    expect([...panel!.querySelectorAll('.nav a')].map((link) => link.getAttribute('href'))).toEqual(
      ['/', '/products', '/cart'],
    );
    expect(panel?.querySelector('button.lang-button')).not.toBeNull();
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

  it('shows a single login pill for anonymous visitors', () => {
    const { element } = setup();

    expect(element.querySelector('a.login-pill')?.getAttribute('href')).toBe('/login');
    expect(element.querySelector('a.avatar')).toBeNull();
  });

  it('reveals orders navigation and links the avatar straight to the profile', () => {
    const { fixture, element } = setup();
    TestBed.inject(AuthService).setAuthenticated({ user: USER, accessToken: 'test-token' });
    fixture.detectChanges();

    const desktopLinks = [...element.querySelectorAll('.desktop-nav .nav a')].map((link) =>
      link.textContent?.trim(),
    );
    expect(desktopLinks).toEqual(['Home', 'Products', 'Cart', 'Orders']);
    expect(element.querySelector('a.login-pill')).toBeNull();

    const avatar = element.querySelector('a.avatar') as HTMLAnchorElement;
    expect(avatar?.getAttribute('href')).toBe('/account/profile');
    expect(avatar?.textContent?.trim()).toBe('A');
    expect(element.querySelector('.account-menu')).toBeNull();
  });

  it('submits header search to the products shelf', () => {
    const { fixture, element } = setup();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    (
      fixture.componentInstance as unknown as { searchText: { set: (v: string) => void } }
    ).searchText.set('linen');
    fixture.detectChanges();
    (element.querySelector('.desktop-search') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );

    expect(navigate).toHaveBeenCalledWith(['/products'], {
      queryParams: { searchTerm: 'linen' },
    });
  });
});
