import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
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
  it('renders the page header with the upcoming-section cards', () => {
    configure();
    const element = render();

    expect(element.querySelector('h1')?.textContent).toBe('Inventory');
    const titles = [...element.querySelectorAll('.inventory-home-card-title')].map(
      (node) => node.textContent,
    );
    expect(titles).toEqual(['Stock', 'Reservations', 'Adjustments']);
    const badges = [...element.querySelectorAll('flux-badge')].map((node) =>
      node.textContent?.trim(),
    );
    expect(badges).toEqual(['Upcoming', 'Upcoming', 'Upcoming']);
    expect(element.querySelector('a')).toBeNull();
  });

  it('localizes the landing page for the active culture', () => {
    configure();
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('fr');
    try {
      const element = render();

      expect(element.querySelector('h1')?.textContent).toBe('Inventaire');
      expect(element.querySelector('flux-badge')?.textContent?.trim()).toBe('Bientôt');
    } finally {
      cultures.setCulture('en');
    }
  });
});
