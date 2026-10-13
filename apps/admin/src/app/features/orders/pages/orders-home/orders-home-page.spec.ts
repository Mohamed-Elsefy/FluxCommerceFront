import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import {
  errorResource,
  idleResource,
  loadingResource,
  provideApi,
  provideAppEnvironment,
  successResource,
  type ResourceState,
} from '@flux/api';
import { ApiError } from '@flux/api';
import { CultureService } from '@flux/i18n';
import type { AdminOrderCountsResponse } from '@flux/models';
import { OrdersOverviewState } from '../../state/orders-overview-state';
import { OrdersHomePage } from './orders-home-page';

function counts(): AdminOrderCountsResponse {
  return { total: 42, pending: 30, confirmed: 10, cancelled: 2 };
}

function setup(scenario: { counts?: ResourceState<AdminOrderCountsResponse> }): {
  refresh: ReturnType<typeof vi.fn>;
} {
  const refresh = vi.fn();
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
      {
        provide: OrdersOverviewState,
        useValue: {
          counts: signal(scenario.counts ?? idleResource()),
          refresh,
        },
      },
    ],
  });
  window.localStorage.clear();
  return { refresh };
}

function render(): HTMLElement {
  const fixture = TestBed.createComponent(OrdersHomePage);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('OrdersHomePage', () => {
  it('loads the overview on init and renders every bucket verbatim', () => {
    const { refresh } = setup({ counts: successResource(counts()) });
    const element = render();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(element.querySelector('h1')?.textContent).toBe('Orders');
    expect(element.querySelector('.orders-home-card-fact')?.textContent).toBe('42 orders');
    const facts = [...element.querySelectorAll('.orders-home-facts > div')].map(
      (row) =>
        `${row.querySelector('dt')?.textContent?.trim()}: ${row
          .querySelector('dd')
          ?.textContent?.trim()}`,
    );
    expect(facts).toEqual(['Pending: 30', 'Confirmed: 10', 'Cancelled: 2']);
    expect(element.querySelector('a')).toBeNull();
  });

  it('renders the loading state while the overview loads', () => {
    setup({ counts: loadingResource() });
    const element = render();

    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();
    expect(element.querySelector('.orders-home-card')).toBeNull();
  });

  it('renders the error state with retry that re-enters refresh', () => {
    const { refresh } = setup({
      counts: errorResource(new ApiError({ status: 403, message: 'Forbidden.' })),
    });
    const element = render();

    expect(element.querySelector('flux-error-state')).not.toBeNull();
    expect(element.textContent).toContain('Could not load orders');

    const retry = element.querySelector('flux-error-state button');
    expect(retry).not.toBeNull();
    (retry as HTMLButtonElement).click();

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('localizes the landing page for the active culture', () => {
    setup({ counts: successResource(counts()) });
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('fr');
    try {
      const element = render();

      expect(element.querySelector('h1')?.textContent).toBe('Commandes');
      expect(element.querySelector('.orders-home-card-fact')?.textContent).toBe('42 commandes');
    } finally {
      cultures.setCulture('en');
    }
  });
});
