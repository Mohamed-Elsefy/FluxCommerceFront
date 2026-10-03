import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
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
import { OrdersAdminApiService } from '../../data-access/orders-admin-api.service';
import { OrderDetailsState } from '../../state/order-details-state';
import { OrderPaymentState } from '../../state/order-payment-state';
import type { OrderPaymentView } from '../../models/orders-admin.models';
import { AdminNotificationService } from '../../../../shared/notifications/notification-service';
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
  cancelOrder: ReturnType<typeof vi.fn>;
  refundOrder: ReturnType<typeof vi.fn>;
} {
  const load = vi.fn();
  const loadPayment = vi.fn();
  const cancelOrder = vi.fn(() => of(envelopeOrder()));
  const refundOrder = vi.fn(() => of(envelopeOrder()));
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
      { provide: OrdersAdminApiService, useValue: { cancelOrder, refundOrder } },
    ],
  });
  window.localStorage.clear();
  return { load, loadPayment, cancelOrder, refundOrder };
}

function envelopeOrder() {
  return { isSuccess: true, message: 'Operation completed successfully.', data: order() };
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

function render(): { fixture: ComponentFixture<OrderDetailsPage>; element: HTMLElement } {
  const fixture = TestBed.createComponent(OrderDetailsPage);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('OrderDetailsPage', () => {
  it('loads the order for the route id and renders header, facts, items, and addresses', () => {
    const { load } = setup({ order: successResource(order()) });
    const { element } = render();

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
    const { element } = render();

    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();
    expect(element.querySelector('h1')).toBeNull();
  });

  it('renders the error state with retry that reloads the order', () => {
    const { load } = setup({
      order: errorResource<OrderDetailsResponse>(
        new ApiError({ status: 404, message: 'Not found.' }),
      ),
    });
    const { element } = render();

    expect(element.querySelector('flux-error-state')).not.toBeNull();
    expect(element.textContent).toContain('Could not load order');

    load.mockClear();
    (element.querySelector('flux-error-state button') as HTMLButtonElement).click();

    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith('order-1');
  });

  it('renders the items empty state for orders without line items', () => {
    setup({ order: successResource(order({ lineItems: [] })) });
    const { element } = render();

    expect(element.querySelector('h1')?.textContent).toBe('ORD-ABC123');
    expect(element.textContent).toContain('No items on this order.');
  });

  it('localizes the details for the active culture', () => {
    setup({ order: successResource(order()) });
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('fr');
    try {
      const { element } = render();

      expect(element.querySelector('.order-details-back')?.textContent).toBe(
        'Retour aux commandes',
      );
      expect(element.textContent).toContain('Informations client');
    } finally {
      cultures.setCulture('en');
    }
  });

  it('renders the details under the RTL culture without key leakage', () => {
    setup({ order: successResource(order()) });
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('ar');
    try {
      const { element } = render();

      expect(element.querySelector('.order-details-back')?.textContent).toBe('عودة إلى الطلبات');
      expect(element.textContent).toContain('معلومات العميل');
      expect(element.textContent).toContain('أصناف الطلب');
      expect(element.textContent).toContain('الدفع');
      expect(element.textContent).not.toContain('orders.details.back');
      expect(element.textContent).not.toContain('orders.payment.title');
      expect(element.querySelector('h1')?.textContent).toBe('ORD-ABC123');
    } finally {
      cultures.setCulture('en');
    }
  });

  it('loads the payment for the route id and renders its facts', () => {
    const { loadPayment } = setup({ order: successResource(order()) });
    const { element } = render();

    expect(loadPayment).toHaveBeenCalledTimes(1);
    expect(loadPayment).toHaveBeenCalledWith('order-1');
    expect(element.textContent).toContain('Payment');
    const badge = element.querySelector('app-payment-status-badge flux-badge .badge');
    expect(badge?.textContent?.trim()).toBe('Processing');
    expect(badge?.getAttribute('data-variant')).toBe('info');
    expect(element.textContent).toContain('pi_live');
    expect(element.textContent).toContain('stripe');
  });

  it('renders failed payments with the backend-supplied status and no invented reason', () => {
    setup({
      order: successResource(order()),
      payment: successResource(paymentView({ status: 'Failed' })),
    });
    const { element } = render();

    const badge = element.querySelector('app-payment-status-badge flux-badge .badge');
    expect(badge?.textContent?.trim()).toBe('Failed');
    expect(badge?.getAttribute('data-variant')).toBe('danger');
    expect(element.textContent).not.toContain('reason');
  });

  it('renders the payment empty notice when no payment exists', () => {
    setup({
      order: successResource(order()),
      payment: errorResource<OrderPaymentView>(
        new ApiError({ status: 404, message: 'Not found.' }),
      ),
    });
    const { element } = render();

    expect(element.querySelector('h1')?.textContent).toBe('ORD-ABC123');
    expect(element.textContent).toContain('No payment information');
    expect(element.textContent).toContain('This order has no payment yet.');
  });

  it('renders the payment error state with retry that reloads the payment', () => {
    const { loadPayment } = setup({
      order: successResource(order()),
      payment: errorResource<OrderPaymentView>(new ApiError({ status: 409, message: 'Conflict.' })),
    });
    const { element } = render();

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
    const { element } = render();

    expect(element.textContent).toContain('Payment');
    expect(element.textContent).toContain('Loading payment…');
    expect(element.querySelector('h1')?.textContent).toBe('ORD-ABC123');
  });

  it('force-cancels a Pending order behind the confirm dialog', () => {
    const { cancelOrder, load } = setup({ order: successResource(order()) });
    const { fixture, element } = render();
    const cancel = [...element.querySelectorAll('.order-details-actions-row button')].find(
      (button) => button.textContent?.trim() === 'Cancel order',
    ) as HTMLButtonElement;
    expect(cancel).not.toBeUndefined();
    cancel.click();
    fixture.detectChanges();
    expect(element.textContent).toContain('Force-cancel order ORD-ABC123?');
    const confirm = element.querySelector('.order-details-dialog-confirm') as HTMLButtonElement;
    confirm.click();
    expect(cancelOrder).toHaveBeenCalledWith('order-1');
    expect(load).toHaveBeenCalledTimes(2);
    const notifications = TestBed.inject(AdminNotificationService).notifications();
    expect(notifications.at(-1)?.title).toBe('Order cancelled');
  });

  it('hides both actions for terminal non-Confirmed orders', () => {
    setup({ order: successResource(order({ status: 'Cancelled' })) });
    const { element } = render();
    expect(element.querySelector('.order-details-actions')).toBeNull();
  });

  it('refunds a Confirmed order with a reason behind the dialog', () => {
    const { refundOrder, load } = setup({ order: successResource(order({ status: 'Confirmed' })) });
    const { fixture, element } = render();
    const refund = [...element.querySelectorAll('.order-details-actions-row button')].find(
      (button) => button.textContent?.trim() === 'Refund order',
    ) as HTMLButtonElement;
    expect(refund).not.toBeUndefined();
    refund.click();
    fixture.detectChanges();
    const reason = element.querySelector('#order-refund-reason') as HTMLTextAreaElement;
    reason.value = 'Duplicate charge';
    reason.dispatchEvent(new Event('input'));
    const confirm = element.querySelector('.order-details-dialog-confirm') as HTMLButtonElement;
    confirm.click();
    expect(refundOrder).toHaveBeenCalledWith('order-1', { reason: 'Duplicate charge' });
    expect(load).toHaveBeenCalledTimes(2);
    const notifications = TestBed.inject(AdminNotificationService).notifications();
    expect(notifications.at(-1)?.title).toBe('Refund started');
  });

  it('blocks empty refund reasons without calling', () => {
    const { refundOrder } = setup({ order: successResource(order({ status: 'Confirmed' })) });
    const { fixture, element } = render();
    const refund = [...element.querySelectorAll('.order-details-actions-row button')].find(
      (button) => button.textContent?.trim() === 'Refund order',
    ) as HTMLButtonElement;
    refund.click();
    fixture.detectChanges();
    const confirm = element.querySelector('.order-details-dialog-confirm') as HTMLButtonElement;
    confirm.click();
    expect(refundOrder).not.toHaveBeenCalled();
  });

  it('surfaces refund conflicts through an error toast without reload', () => {
    const failure = new ApiError({ status: 409, message: 'Not eligible.' });
    const { refundOrder, load } = setup({ order: successResource(order({ status: 'Confirmed' })) });
    vi.mocked(refundOrder).mockReturnValue(throwError(() => failure));
    const { fixture, element } = render();
    const refund = [...element.querySelectorAll('.order-details-actions-row button')].find(
      (button) => button.textContent?.trim() === 'Refund order',
    ) as HTMLButtonElement;
    refund.click();
    fixture.detectChanges();
    const reason = element.querySelector('#order-refund-reason') as HTMLTextAreaElement;
    reason.value = 'Duplicate charge';
    reason.dispatchEvent(new Event('input'));
    const confirm = element.querySelector('.order-details-dialog-confirm') as HTMLButtonElement;
    confirm.click();
    expect(refundOrder).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(1);
    const notifications = TestBed.inject(AdminNotificationService).notifications();
    expect(notifications.at(-1)?.title).toBe('Request failed');
  });
});
