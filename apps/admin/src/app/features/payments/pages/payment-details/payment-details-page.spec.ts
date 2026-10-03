import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import {
  ApiError,
  errorResource,
  loadingResource,
  provideApi,
  provideAppEnvironment,
  successResource,
  type ResourceState,
} from '@flux/api';
import { CultureService } from '@flux/i18n';
import type { PaymentAdminResponse } from '@flux/models';
import { PaymentsAdminApiService } from '../../data-access/payments-admin-api.service';
import { PaymentDetailsState } from '../../state/payment-details-state';
import type { AdminPaymentDetailsRecord } from '../../models/payments-admin.models';
import { PaymentDetailsPage } from './payment-details-page';

function payment(overrides: Partial<PaymentAdminResponse> = {}): PaymentAdminResponse {
  return {
    id: 'pay-1',
    orderId: 'order-1',
    customerId: 'cust-1',
    amount: 59.98,
    currency: 'USD',
    status: 'Succeeded',
    providerPaymentIntentId: 'pi_123',
    provider: 'stripe',
    createdAtUtc: '2026-09-28T10:00:00Z',
    updatedAtUtc: '2026-09-28T10:01:00Z',
    version: 2,
    ...overrides,
  };
}

function setup(scenario: { payment: ResourceState<AdminPaymentDetailsRecord> }): {
  load: ReturnType<typeof vi.fn>;
} {
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
        provide: ActivatedRoute,
        useValue: { paramMap: of(convertToParamMap({ id: 'pay-1' })) },
      },
      {
        provide: PaymentDetailsState,
        useValue: { payment: signal(scenario.payment), load },
      },
      {
        provide: PaymentsAdminApiService,
        useValue: { getPayment: vi.fn(() => of({ isSuccess: true, data: payment() })) },
      },
    ],
  });
  window.localStorage.clear();
  return { load };
}

function render(): { fixture: ComponentFixture<PaymentDetailsPage>; element: HTMLElement } {
  const fixture = TestBed.createComponent(PaymentDetailsPage);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('PaymentDetailsPage', () => {
  it('loads the payment for the route id and renders header, badge, and facts', () => {
    const { load } = setup({ payment: successResource(payment()) });
    const { element } = render();

    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith('pay-1');
    expect(element.querySelector('h1')?.textContent).toBe('pi_123');
    expect(
      element.querySelector('app-admin-payment-status-badge flux-badge')?.textContent?.trim(),
    ).toBe('Succeeded');
    expect(element.querySelector('.payment-details-back')?.getAttribute('href')).toBe(
      '/payments/list',
    );
    expect(element.textContent).toContain('59.98');
    expect(element.textContent).toContain('stripe');
    expect(element.textContent).toContain('order-1');
    expect(element.textContent).toContain('cust-1');
  });

  it('falls back to the payment id when no intent reference exists', () => {
    setup({ payment: successResource(payment({ providerPaymentIntentId: null })) });
    const { element } = render();

    expect(element.querySelector('h1')?.textContent).toBe('pay-1');
  });

  it('renders the loading state while the payment loads', () => {
    setup({ payment: loadingResource<PaymentAdminResponse>() });
    const { element } = render();

    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();
    expect(element.querySelector('h1')).toBeNull();
  });

  it('renders the error state with retry that reloads the payment', () => {
    const { load } = setup({
      payment: errorResource<PaymentAdminResponse>(
        new ApiError({ status: 404, message: 'Not found.' }),
      ),
    });
    const { element } = render();

    expect(element.querySelector('flux-error-state')).not.toBeNull();
    expect(element.textContent).toContain('Could not load payment');

    load.mockClear();
    (element.querySelector('flux-error-state button') as HTMLButtonElement).click();

    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith('pay-1');
  });

  it('localizes the details for the active culture', () => {
    setup({ payment: successResource(payment()) });
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('fr');
    try {
      const { element } = render();

      expect(element.querySelector('.payment-details-back')?.textContent).toBe(
        'Retour aux paiements',
      );
      expect(element.textContent).toContain('Montant');
    } finally {
      cultures.setCulture('en');
    }
  });

  it('renders the details under the RTL culture without key leakage', () => {
    setup({ payment: successResource(payment()) });
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('ar');
    try {
      const { element } = render();

      expect(element.querySelector('.payment-details-back')?.textContent).toBe(
        'عودة إلى المدفوعات',
      );
      expect(element.textContent).toContain('المبلغ');
      expect(element.textContent).not.toContain('payments.details.back');
    } finally {
      cultures.setCulture('en');
    }
  });
});
