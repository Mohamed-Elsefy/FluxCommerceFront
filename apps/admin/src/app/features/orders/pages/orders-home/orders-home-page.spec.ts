import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { provideApi, provideAppEnvironment, type ResourceStatus } from '@flux/api';
import { ApiError } from '@flux/api';
import { CultureService } from '@flux/i18n';
import { OrdersOverviewState } from '../../state/orders-overview-state';
import type { OrdersOverview } from '../../models/orders-admin.models';
import { OrdersHomePage } from './orders-home-page';

interface OverviewScenario {
  status: ResourceStatus;
  overview: OrdersOverview | null;
  error?: ApiError | null;
}

function setup(scenario: OverviewScenario): { refresh: ReturnType<typeof vi.fn> } {
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
          status: signal(scenario.status),
          overview: signal(scenario.overview),
          error: signal(scenario.error ?? null),
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
  it('loads the overview on init and renders the summary fact on success', () => {
    const { refresh } = setup({ status: 'success', overview: { orderTotal: 42 } });
    const element = render();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(element.querySelector('h1')?.textContent).toBe('Orders');
    expect(element.querySelector('.orders-home-card-fact')?.textContent).toBe('42 orders');
    expect(element.querySelector('a')).toBeNull();
  });

  it('renders the loading state while the overview loads', () => {
    setup({ status: 'loading', overview: null });
    const element = render();

    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();
    expect(element.querySelector('.orders-home-card')).toBeNull();
  });

  it('renders the error state with retry that re-enters refresh', () => {
    const { refresh } = setup({
      status: 'error',
      overview: null,
      error: new ApiError({ status: 403, message: 'Forbidden.' }),
    });
    const element = render();

    expect(element.querySelector('flux-error-state')).not.toBeNull();
    expect(element.textContent).toContain('Could not load orders');

    const retry = element.querySelector('flux-error-state button');
    expect(retry).not.toBeNull();
    (retry as HTMLButtonElement).click();

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('renders the empty state when no order data exists', () => {
    setup({ status: 'empty', overview: { orderTotal: 0 } });
    const element = render();

    expect(element.querySelector('flux-empty-state')).not.toBeNull();
    expect(element.textContent).toContain('No orders yet');
    expect(element.querySelector('.orders-home-card')).toBeNull();
  });

  it('localizes the landing page for the active culture', () => {
    setup({ status: 'success', overview: { orderTotal: 3 } });
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('fr');
    try {
      const element = render();

      expect(element.querySelector('h1')?.textContent).toBe('Commandes');
      expect(element.querySelector('.orders-home-card-fact')?.textContent).toBe('3 commandes');
    } finally {
      cultures.setCulture('en');
    }
  });
});
