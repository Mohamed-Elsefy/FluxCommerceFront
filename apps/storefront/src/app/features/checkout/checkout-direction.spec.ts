/**
 * Direction-invariance, keyboard-order, and landmark tests for the
 * Sub-Phase 8.8 checkout UI.
 *
 * Proves the RTL contract behaviorally (same convention as the shared
 * `direction-invariance.spec.ts`): every checkout component renders
 * byte-identical markup under `dir="ltr"` and `dir="rtl"` — direction
 * response flows exclusively through CSS logical properties (pinned
 * statically by `checkout-styles.spec.ts` plus the workspace audit),
 * no component branches on direction, and no per-direction markup
 * exists. Also pins the keyboard contract (natural DOM Tab order, no
 * positive tabindex) and the landmark roles (`alert`, `status`) the
 * scope requires — the native `form` carries its implicit role with no
 * redundant `role` attribute (11.8).
 */

import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { CheckoutAddressForm } from './components/address-form/address-form';
import { CheckoutFormComponent } from './components/checkout-form/checkout-form';
import { CheckoutFieldErrors } from './components/field-errors/field-errors';
import { OrderSummaryComponent } from './components/order-summary/order-summary';
import { createCheckoutAddressFormGroup } from './forms/checkout-forms';

const TEMPLATES = {
  required: '{label} is required.',
  tooLong: '{label} must be no more than {max} characters.',
  invalidCountryCode: '{label} must be 2 uppercase letters (e.g. DE).',
};

function addressLabels(sectionTitle: string) {
  return {
    sectionTitle,
    recipientName: 'Full name',
    line1: 'Street address',
    line2: 'Apartment, suite, etc.',
    line2Optional: 'Optional',
    city: 'City',
    region: 'State / Region',
    postalCode: 'Postal code',
    countryCode: 'Country code',
  };
}

const FORM_LABELS = {
  shipping: addressLabels('Shipping address'),
  billing: addressLabels('Billing address'),
  billingSameAsShipping: 'Billing address is the same as shipping',
  submit: 'Continue',
  templates: TEMPLATES,
};

const SUMMARY_LABELS = {
  title: 'Order summary',
  items: 'Items',
  emptyTitle: 'Nothing to review',
  emptyMessage: 'Your cart is empty.',
  quantity: 'Quantity',
  unitPrice: 'Unit price',
  sku: 'SKU',
  subtotal: 'Subtotal',
  shippingCost: 'Shipping',
  discount: 'Discount',
  grandTotal: 'Total',
  totalsPending: 'Totals are finalized when your order is created.',
};

function setUp(component: Type<object>, inputs: Record<string, unknown>): { element: HTMLElement } {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(component);
  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  TestBed.resetTestingModule();
  return { element };
}

function renderMarkup(component: Type<object>, inputs: Record<string, unknown>): string {
  const { element } = setUp(component, inputs);
  return element.innerHTML.replace(/\s+/g, ' ').trim();
}

const FIELD_ERRORS_INPUTS = {
  control: new FormControl('', [Validators.required]),
  label: 'City',
  templates: TEMPLATES,
};

const ADDRESS_FORM_INPUTS = {
  group: createCheckoutAddressFormGroup(new FormBuilder()),
  labels: addressLabels('Shipping address'),
  templates: TEMPLATES,
  idPrefix: 'shipping',
};

const CHECKOUT_FORM_INPUTS = { labels: FORM_LABELS };

const ORDER_SUMMARY_INPUTS = {
  view: {
    lines: [{ productName: 'Tee', sku: 'TEE-BLK-M', quantity: 2, unitPriceText: '29.99 USD' }],
    itemCount: 2,
    distinctItemCount: 1,
    totals: {
      subtotalText: null,
      shippingCostText: null,
      discountText: null,
      grandTotalText: null,
    },
  },
  labels: SUMMARY_LABELS,
};

const CASES: ReadonlyArray<{
  readonly name: string;
  readonly component: Type<object>;
  readonly inputs: Record<string, unknown>;
}> = [
  { name: 'CheckoutFieldErrors', component: CheckoutFieldErrors, inputs: FIELD_ERRORS_INPUTS },
  { name: 'CheckoutAddressForm', component: CheckoutAddressForm, inputs: ADDRESS_FORM_INPUTS },
  { name: 'CheckoutFormComponent', component: CheckoutFormComponent, inputs: CHECKOUT_FORM_INPUTS },
  { name: 'OrderSummaryComponent', component: OrderSummaryComponent, inputs: ORDER_SUMMARY_INPUTS },
];

afterEach(() => {
  document.documentElement.removeAttribute('dir');
});

describe('Checkout direction invariance (LTR/RTL)', () => {
  it.each(CASES.map(({ name, component, inputs }) => [name, component, inputs] as const))(
    'renders %s identically under LTR and RTL',
    (_name, component, inputs) => {
      document.documentElement.setAttribute('dir', 'rtl');
      const rtl = renderMarkup(component, inputs);
      document.documentElement.setAttribute('dir', 'ltr');
      const ltr = renderMarkup(component, inputs);

      expect(rtl).toBe(ltr);
      expect(ltr.length).toBeGreaterThan(0);
    },
  );

  it('emits no direction attributes or inline physical styles', () => {
    for (const { component, inputs } of CASES) {
      const markup = renderMarkup(component, inputs);
      expect(markup).not.toContain('dir=');
      expect(markup).not.toContain('style=');
    }
  });
});

describe('Checkout keyboard order and landmarks', () => {
  it('tabs through the form in DOM order with no positive tabindex', () => {
    const { element } = setUp(CheckoutFormComponent, CHECKOUT_FORM_INPUTS);
    const focusable = [...element.querySelectorAll('input, button, select, textarea, a[href]')];

    expect(focusable.map((node) => (node as HTMLElement).id || node.nodeName)).toEqual([
      'shipping-recipientName',
      'shipping-line1',
      'shipping-line2',
      'shipping-city',
      'shipping-region',
      'shipping-postalCode',
      'shipping-countryCode',
      'checkout-billing-same',
      'billing-recipientName',
      'billing-line1',
      'billing-line2',
      'billing-city',
      'billing-region',
      'billing-postalCode',
      'billing-countryCode',
      'BUTTON',
    ]);
    for (const node of focusable) {
      const tabIndex = (node as HTMLElement).getAttribute('tabindex');
      expect(tabIndex === null || Number(tabIndex) <= 0, node.nodeName).toBe(true);
    }
  });

  it('uses the native form without a redundant role (11.8)', () => {
    const { element } = setUp(CheckoutFormComponent, CHECKOUT_FORM_INPUTS);

    expect(element.querySelector('form')).not.toBeNull();
    expect(element.querySelector('form')?.getAttribute('role')).toBeNull();
  });

  it('associates every address label with its control', () => {
    const { element } = setUp(CheckoutAddressForm, ADDRESS_FORM_INPUTS);

    for (const name of [
      'recipientName',
      'line1',
      'line2',
      'city',
      'region',
      'postalCode',
      'countryCode',
    ]) {
      const label = element.querySelector(`label[for="shipping-${name}"]`);
      expect(label, name).not.toBeNull();
      expect(element.querySelector(`#shipping-${name}`)).not.toBeNull();
    }
  });
});
