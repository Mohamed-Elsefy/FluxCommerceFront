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
import type { PaymentAdminStatsResponse } from '@flux/models';
import { PaymentsStatsState } from '../../state/payments-stats-state';
import { PaymentsHomePage } from './payments-home-page';

function stats(): PaymentAdminStatsResponse {
  return {
    total: 7,
    pending: 1,
    processing: 1,
    succeeded: 3,
    failed: 1,
    cancelled: 0,
    refunded: 1,
    totalsByCurrency: [{ currency: 'USD', succeededCount: 3, succeededTotalAmount: 179.94 }],
  };
}

function setup(scenario: { stats?: ResourceState<PaymentAdminStatsResponse> }): {
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
        provide: PaymentsStatsState,
        useValue: {
          stats: signal(scenario.stats ?? idleResource()),
          refresh,
        },
      },
    ],
  });
  window.localStorage.clear();
  return { refresh };
}

function render(): HTMLElement {
  const fixture = TestBed.createComponent(PaymentsHomePage);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('PaymentsHomePage', () => {
  it('loads the overview on init and renders every bucket verbatim', () => {
    const { refresh } = setup({ stats: successResource(stats()) });
    const element = render();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(element.querySelector('h1')?.textContent).toBe('Payments');
    expect(element.querySelector('.payments-home-card-fact')?.textContent).toBe('7 payments');
    const facts = [...element.querySelectorAll('.payments-home-facts > div')].map(
      (row) =>
        `${row.querySelector('dt')?.textContent?.trim()}: ${row
          .querySelector('dd')
          ?.textContent?.trim()}`,
    );
    expect(facts).toContain('Pending: 1');
    expect(facts).toContain('Succeeded: 3');
    expect(facts).toContain('Refunded: 1');
    expect(element.textContent).toContain('USD');
  });

  it('renders the loading state while the overview loads', () => {
    setup({ stats: loadingResource() });
    const element = render();

    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();
    expect(element.querySelector('.payments-home-card')).toBeNull();
  });

  it('renders the error state with retry that re-enters refresh', () => {
    const { refresh } = setup({
      stats: errorResource(new ApiError({ status: 403, message: 'Forbidden.' })),
    });
    const element = render();

    expect(element.querySelector('flux-error-state')).not.toBeNull();
    expect(element.textContent).toContain('Could not load payments');

    const retry = element.querySelector('flux-error-state button');
    expect(retry).not.toBeNull();
    (retry as HTMLButtonElement).click();

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('localizes the landing page for the active culture', () => {
    setup({ stats: successResource(stats()) });
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('fr');
    try {
      const element = render();

      expect(element.querySelector('h1')?.textContent).toBe('Paiements');
      expect(element.querySelector('.payments-home-card-fact')?.textContent).toBe('7 paiements');
    } finally {
      cultures.setCulture('en');
    }
  });

  it('renders the landing page under the RTL culture without key leakage', () => {
    setup({ stats: successResource(stats()) });
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('ar');
    try {
      const element = render();

      expect(element.querySelector('h1')?.textContent).toBe('المدفوعات');
      expect(element.textContent).not.toContain('payments.title');
    } finally {
      cultures.setCulture('en');
    }
  });
});
