import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { idleResource, provideApi, provideAppEnvironment, successResource } from '@flux/api';
import { CultureService } from '@flux/i18n';
import type { InventoryCountsResponse } from '@flux/models';
import { InventoryCountsState } from '../../state/inventory-counts-state';
import { InventoryHomePage } from './inventory-home-page';

function counts(): InventoryCountsResponse {
  return {
    totalItems: 12,
    totalOnHand: 100,
    totalReserved: 8,
    lowStockItems: 2,
    pendingReservations: 1,
    committedReservations: 3,
    releasedReservations: 0,
    expiredReservations: 1,
  };
}

function configure(countsResource = idleResource()): { load: ReturnType<typeof vi.fn> } {
  const load = vi.fn();
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
      {
        provide: InventoryCountsState,
        useValue: { counts: signal(countsResource), load, reload: vi.fn() },
      },
    ],
  });
  window.localStorage.clear();
  return { load };
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
      'New item',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/inventory/stock',
      '/inventory/reservations',
      '/inventory/adjustments',
      '/inventory/new',
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

  it('renders the landing page under the RTL culture without key leakage', () => {
    configure();
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('ar');
    try {
      const element = render();

      expect(element.querySelector('h1')?.textContent).toBe('المخزون');
      expect(element.textContent).not.toContain('inventory.title');
    } finally {
      cultures.setCulture('en');
    }
  });

  it('loads the counts snapshot and renders every bucket verbatim', () => {
    const { load } = configure(successResource(counts()));
    const element = render();

    expect(load).toHaveBeenCalledTimes(1);
    const facts = [...element.querySelectorAll('.inventory-home-facts > div')].map(
      (row) =>
        `${row.querySelector('dt')?.textContent?.trim()}: ${row.querySelector('dd')?.textContent?.trim()}`,
    );
    expect(facts).toHaveLength(8);
    expect(facts).toContain('Total items: 12');
    expect(facts).toContain('Low stock items: 2');
  });
});
