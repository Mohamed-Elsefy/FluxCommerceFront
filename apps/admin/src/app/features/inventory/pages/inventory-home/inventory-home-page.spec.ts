import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { provideApi, provideAppEnvironment } from '@flux/api';
import { CultureService } from '@flux/i18n';
import { InventoryHomePage } from './inventory-home-page';

function configure(): void {
  TestBed.configureTestingModule({
    providers: [
      provideAppEnvironment({
        name: 'development',
        production: false,
        appName: 'test',
        apiBaseUrl: '/api',
      }),
      provideApi(),
      provideHttpClientTesting(),
      provideRouter([]),
    ],
  });
  window.localStorage.clear();
}

function render(): HTMLElement {
  const fixture = TestBed.createComponent(InventoryHomePage);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('InventoryHomePage', () => {
  it('renders the page header with linked section cards (no dead links)', () => {
    configure();
    const element = render();

    expect(element.querySelector('h1')?.textContent).toBe('Inventory');
    const links = [...element.querySelectorAll('.inventory-home-card-link')];
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'Stock',
      'Reservations',
      'Adjustments',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/inventory/stock',
      '/inventory/reservations',
      '/inventory/adjustments',
    ]);
    expect(element.querySelector('flux-badge')).toBeNull();
  });

  it('localizes the landing page for the active culture', () => {
    configure();
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('fr');
    try {
      const element = render();

      expect(element.querySelector('h1')?.textContent).toBe('Inventaire');
      expect(element.querySelector('.inventory-home-card-link')?.textContent?.trim()).toBe('Stock');
    } finally {
      cultures.setCulture('en');
    }
  });
});
