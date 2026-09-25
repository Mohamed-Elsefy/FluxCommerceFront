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

    expect(element.querySelector('.brand')?.textContent).toBe('FluxCommerce');
    expect(element.querySelector('.group h2')?.textContent).toBe('Explore');
    expect(
      [...element.querySelectorAll('.group .nav a')].map((link) => link.textContent?.trim()),
    ).toEqual(['Home', 'Catalog', 'Cart']);
    expect(element.querySelector('.legal')?.textContent).toContain(`${new Date().getFullYear()}`);
  });

  it('localizes explore chrome per active culture', () => {
    const element = setup('de');

    expect(element.querySelector('.group h2')?.textContent).toBe('Entdecken');
    expect(
      [...element.querySelectorAll('.group .nav a')].map((link) => link.textContent?.trim()),
    ).toEqual(['Startseite', 'Katalog', 'Warenkorb']);
    expect(element.querySelector('.legal')?.textContent).toContain('Alle Rechte vorbehalten.');

    TestBed.resetTestingModule();
    window.localStorage.clear();
  });
});
