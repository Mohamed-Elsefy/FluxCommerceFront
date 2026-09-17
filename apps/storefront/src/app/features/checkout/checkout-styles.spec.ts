/**
 * Stylesheet audit for the Sub-Phase 8.8 checkout UI.
 *
 * Pins the RTL contract statically at the feature level (complementing
 * the workspace-wide `verify-architecture.mjs` §3.9 audit): every
 * checkout stylesheet uses CSS logical properties only — zero
 * hardcoded physical LTR/RTL declarations — and every viewport media
 * query repeats the canonical theming breakpoints exactly (`var()` is
 * invalid in `@media` conditions, so values repeat literally).
 *
 * Implementation note: component stylesheets reach the document through
 * Angular's emulated encapsulation (one `<style>` per component type),
 * so the audit collects the injected `<style>` contents after rendering
 * the checkout components — the same CSS the browser applies. The page
 * stylesheet is excluded here (creating the page needs its full
 * provider chain) and stays covered by the workspace-wide
 * `verify-architecture.mjs` §3.9 audit, which scans every stylesheet.
 */

import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { FormBuilder } from '@angular/forms';
import { CheckoutAddressForm } from './components/address-form/address-form';
import { CheckoutFormComponent } from './components/checkout-form/checkout-form';
import { CheckoutFieldErrors } from './components/field-errors/field-errors';
import { OrderSummaryComponent } from './components/order-summary/order-summary';
import { createCheckoutAddressFormGroup } from './forms/checkout-forms';
import { FormControl, Validators } from '@angular/forms';

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

/** Renders every checkout component so its styles land in the document. */
function renderAll(): void {
  TestBed.configureTestingModule({});

  const errors = TestBed.createComponent(CheckoutFieldErrors);
  errors.componentRef.setInput('control', new FormControl('', [Validators.required]));
  errors.componentRef.setInput('label', 'City');
  errors.componentRef.setInput('templates', TEMPLATES);
  errors.detectChanges();

  const address = TestBed.createComponent(CheckoutAddressForm);
  address.componentRef.setInput('group', createCheckoutAddressFormGroup(new FormBuilder()));
  address.componentRef.setInput('labels', addressLabels('Shipping address'));
  address.componentRef.setInput('templates', TEMPLATES);
  address.detectChanges();

  const form = TestBed.createComponent(CheckoutFormComponent);
  form.componentRef.setInput('labels', {
    shipping: addressLabels('Shipping address'),
    billing: addressLabels('Billing address'),
    billingSameAsShipping: 'Same',
    submit: 'Continue',
    templates: TEMPLATES,
  });
  form.detectChanges();

  const summary = TestBed.createComponent(OrderSummaryComponent);
  summary.componentRef.setInput('view', null);
  summary.componentRef.setInput('labels', {
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
    totalsPending: 'Pending.',
  });
  summary.detectChanges();
}

/** Aggregate injected component styles for the checkout feature. */
function checkoutCss(): string {
  return [...document.head.querySelectorAll('style')]
    .map((tag) => tag.textContent ?? '')
    .join('\n');
}

const PHYSICAL_PROPERTY =
  /margin-left|margin-right|padding-left|padding-right|border-left|border-right|border-top-left-radius|border-top-right-radius|border-bottom-left-radius|border-bottom-right-radius|float\s*:\s*(left|right)|text-align\s*:\s*(left|right)|translateX\s*\(|\[dir\s*=|:dir\s*\(|scaleX\s*\(/;

const STANDALONE_DIRECTION = /[{;]\s*(left|right)\s*:/;

function forcesTextDirection(css: string): boolean {
  for (const match of css.matchAll(/([-\w]*direction)\s*:\s*(ltr|rtl)/g)) {
    if (match[1] === 'direction') {
      return true;
    }
  }
  return false;
}

afterEach(() => {
  TestBed.resetTestingModule();
});

describe('Checkout stylesheets (RTL-safe logical properties)', () => {
  it('injects one stylesheet per checkout component', () => {
    renderAll();

    expect(document.head.querySelectorAll('style').length).toBeGreaterThanOrEqual(4);
    expect(checkoutCss().length).toBeGreaterThan(0);
  });

  it('uses no physical-direction properties', () => {
    renderAll();
    const css = checkoutCss();

    expect(PHYSICAL_PROPERTY.test(css)).toBe(false);
    expect(STANDALONE_DIRECTION.test(css)).toBe(false);
  });

  it('never forces text direction (Phase 4 owns `dir`)', () => {
    renderAll();

    expect(forcesTextDirection(checkoutCss())).toBe(false);
  });

  it('repeats only canonical breakpoint values in viewport media queries', () => {
    renderAll();
    const canonical = [30, 48, 64, 80];
    const offScale: string[] = [];
    for (const match of checkoutCss().matchAll(
      /\(\s*(?:min|max)-width\s*:\s*([\d.]+)\s*(rem|px|em)\s*\)/g,
    )) {
      const value = Number(match[1]);
      const unit = match[2];
      const onScale = unit === 'rem' && canonical.some((width) => Math.abs(value - width) <= 0.011);
      if (!onScale) {
        offScale.push(match[0]);
      }
    }
    expect(offScale).toEqual([]);
  });
});
