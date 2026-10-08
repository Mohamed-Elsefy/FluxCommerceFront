import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { CultureService } from '@flux/i18n';
import { StorefrontFooter } from './footer';

function setup(culture: 'en' | 'de' = 'en'): HTMLElement {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  window.localStorage.clear();
  TestBed.inject(CultureService).setCulture(culture);
  const fixture = TestBed.createComponent(StorefrontFooter);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('StorefrontFooter', () => {
  it('renders the brand, explore group, and copyright line', () => {
    const element = setup();

    expect(element.querySelector('.brand')?.textContent).toBe('fluxcommerce.');
    expect(element.querySelector('.group h2')?.textContent).toBe('Explore');
    expect(
      [...element.querySelectorAll('.group .nav a')].map((link) => link.textContent?.trim()),
    ).toEqual([
      'Home',
      'Catalog',
      'Products',
      'Cart',
      'Checkout',
      'Profile',
      'Orders',
      'Payments',
      'Login',
    ]);
    expect(element.querySelector('.description')?.textContent).toContain('enterprise-grade');
    expect(element.querySelector('.legal')?.textContent).toContain(`${new Date().getFullYear()}`);
  });

  it('renders shop, account, and the reserved personal placeholder', () => {
    const element = setup();
    const headings = [...element.querySelectorAll('.group h2')].map((h) => h.textContent);

    expect(headings).toEqual(['Explore', 'Shop', 'Account', 'About']);
    expect(element.querySelector('.personal .placeholder')?.textContent).toBe(
      'Personal info coming soon.',
    );
  });

  it('localizes explore chrome per active culture', () => {
    const element = setup('de');

    expect(element.querySelector('.group h2')?.textContent).toBe('Entdecken');
    expect(element.querySelector('.personal .placeholder')?.textContent).toBe(
      'Persönliche Infos folgen in Kürze.',
    );
    expect(element.querySelector('.legal')?.textContent).toContain('Alle Rechte vorbehalten.');

    TestBed.resetTestingModule();
    window.localStorage.clear();
  });
});
