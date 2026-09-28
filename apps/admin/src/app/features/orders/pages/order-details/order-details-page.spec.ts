import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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
import type { OrderDetailsResponse } from '@flux/models';
import { OrderDetailsState } from '../../state/order-details-state';
import { OrderPaymentState } from '../../state/order-payment-state';
import type { OrderPaymentView } from '../../models/orders-admin.models';
import { OrderDetailsPage } from './order-details-page';

function paymentView(overrides: Partial<OrderPaymentView> = {}): OrderPaymentView {
  return {
    status: 'Processing',
    reference: 'pi_live',
    provider: 'stripe',
    amount: 59.98,
    currency: 'USD',
    ...overrides,
  };
}

function setup(scenario: {
  order: ResourceState<OrderDetailsResponse>;
  payment?: ResourceState<OrderPaymentView>;
}): {
  load: ReturnType<typeof vi.fn>;
  loadPayment: ReturnType<typeof vi.fn>;
} {
  const load = vi.fn();
  const loadPayment = vi.fn();
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
        useValue: { paramMap: of(convertToParamMap({ id: 'order-1' })) },
      },
      { provide: OrderDetailsState, useValue: { order: signal(scenario.order), load } },
      {
        provide: OrderPaymentState,
        useValue: {
          payment: signal(scenario.payment ?? successResource(paymentView())),
          load: loadPayment,
        },
      },
    ],
  });
  window.localStorage.clear();
  return { load, loadPayment };
}

function address() {
  return {
    recipientName: 'Ada Lovelace',
    line1: '1 Flux St',
    line2: null as string | null,
    city: 'Berlin',
    region: 'BE',
    postalCode: '10115',
    countryCode: 'DE',
  };
}

function order(overrides: Partial<OrderDetailsResponse> = {}): OrderDetailsResponse {
  return {
    orderId: 'order-1',
    orderNumber: 'ORD-ABC123',
    status: 'Pending',
    subtotal: { amount: 59.98, currency: 'USD' },
    shippingCost: { amount: 0, currency: 'USD' },
    discount: { amount: 0, currency: 'USD' },
    grandTotal: { amount: 59.98, currency: 'USD' },
    itemCount: 2,
    createdAtUtc: '2026-09-28T10:00:00Z',
    shippingAddress: address(),
    billingAddress: address(),
    lineItems: [
      {
        productName: 'Tee',
        sku: 'TEE-BLK-M',
        quantity: 2,
        unitPrice: 29.99,
        unitPriceCurrency: 'USD',
        lineTotal: 59.98,
        lineTotalCurrency: 'USD',
      },
    ],
    ...overrides,
  };
}

function render(): HTMLElement {
  const fixture = TestBed.createComponent(OrderDetailsPage);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('OrderDetailsPage', () => {
  it('loads the order for the route id and renders header, facts, items, and addresses', () => {
    const { load } = setup({ order: successResource(order()) });
    const element = render();

    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith('order-1');
    expect(element.querySelector('h1')?.textContent).toBe('ORD-ABC123');
    expect(element.querySelector('app-order-status-badge flux-badge')?.textContent?.trim()).toBe(
      'Pending',
    );
    expect(element.querySelector('.order-details-back')?.getAttribute('href')).toBe('/orders/list');
    expect(element.textContent).toContain('59.98');
    const body = [...element.querySelectorAll('tbody tr')].map((row) =>
      [...row.querySelectorAll('td')].map((cell) => cell.textContent?.trim()),
    );
    expect(body).toHaveLength(1);
    expect(body[0]?.[0]).toBe('Tee');
    expect(body[0]?.[1]).toBe('TEE-BLK-M');
    expect(element.textContent).toContain('Customer information');
    expect(element.textContent).toContain('Shipping address');
    expect(element.textContent).toContain('Billing address');
    expect(element.textContent).toContain('Ada Lovelace');
    expect(element.textContent).toContain('Berlin');
  });

  it('renders the loading state while the order loads', () => {
    setup({ order: loadingResource<OrderDetailsResponse>() });
    const element = render();

    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();
    expect(element.querySelector('h1')).toBeNull();
  });

  it('renders the error state with retry that reloads the order', () => {
    const { load } = setup({
      order: errorResource<OrderDetailsResponse>(
        new ApiError({ status: 404, message: 'Not found.' }),
      ),
    });
    const element = render();

    expect(element.querySelector('flux-error-state')).not.toBeNull();
    expect(element.textContent).toContain('Could not load order');

    load.mockClear();
    (element.querySelector('flux-error-state button') as HTMLButtonElement).click();

    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith('order-1');
  });

  it('renders the items empty state for orders without line items', () => {
    setup({ order: successResource(order({ lineItems: [] })) });
    const element = render();

    expect(element.querySelector('h1')?.textContent).toBe('ORD-ABC123');
    expect(element.textContent).toContain('No items on this order.');
  });

  it('localizes the details for the active culture', () => {
    setup({ order: successResource(order()) });
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('fr');
    try {
      const element = render();

      expect(element.querySelector('.order-details-back')?.textContent).toBe(
        'Retour aux commandes',
      );
      expect(element.textContent).toContain('Informations client');
    } finally {
      cultures.setCulture('en');
    }
  });

  it('loads the payment for the route id and renders its facts', () => {
    const { loadPayment } = setup({ order: successResource(order()) });
    const element = render();

    expect(loadPayment).toHaveBeenCalledTimes(1);
    expect(loadPayment).toHaveBeenCalledWith('order-1');
    expect(element.textContent).toContain('Payment');
    expect(element.textContent).toContain('Processing');
    expect(element.textContent).toContain('pi_live');
    expect(element.textContent).toContain('stripe');
  });

  it('renders the payment empty notice when no payment exists', () => {
    setup({
      order: successResource(order()),
      payment: errorResource<OrderPaymentView>(
        new ApiError({ status: 404, message: 'Not found.' }),
      ),
    });
    const element = render();

    expect(element.querySelector('h1')?.textContent).toBe('ORD-ABC123');
    expect(element.textContent).toContain('No payment information');
    expect(element.textContent).toContain('This order has no payment yet.');
  });

  it('renders the payment error state with retry that reloads the payment', () => {
    const { loadPayment } = setup({
      order: successResource(order()),
      payment: errorResource<OrderPaymentView>(new ApiError({ status: 409, message: 'Conflict.' })),
    });
    const element = render();

    expect(element.textContent).toContain('Could not load payment');

    loadPayment.mockClear();
    const errors = [...element.querySelectorAll('flux-error-state button')];
    (errors[errors.length - 1] as HTMLButtonElement).click();

    expect(loadPayment).toHaveBeenCalledTimes(1);
    expect(loadPayment).toHaveBeenCalledWith('order-1');
  });

  it('renders the payment loading state while the payment loads', () => {
    setup({
      order: successResource(order()),
      payment: loadingResource<OrderPaymentView>(),
    });
    const element = render();

    expect(element.textContent).toContain('Payment');
    expect(element.textContent).toContain('Loading payment…');
    expect(element.querySelector('h1')?.textContent).toBe('ORD-ABC123');
  });
});
