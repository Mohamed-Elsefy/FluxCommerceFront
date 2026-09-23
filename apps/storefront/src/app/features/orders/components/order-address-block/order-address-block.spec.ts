/**
 * Component tests for the Sub-Phase 10.4 `OrderAddressBlock`.
 *
 * Covers the presentational contract only (recipient, display lines,
 * section heading): the component holds no state and performs no HTTP
 * — address projection stays in `order-details.models.spec.ts`.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OrderAddressBlock } from './order-address-block';
import type { OrderAddressView } from '../../models/order-details.models';

const ADDRESS: OrderAddressView = {
  recipientName: 'Ada Lovelace',
  lines: ['1 Flux St', 'Berlin, BE 10115', 'DE'],
};

function setup(address: OrderAddressView = ADDRESS): {
  fixture: ComponentFixture<OrderAddressBlock>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(OrderAddressBlock);
  fixture.componentRef.setInput('address', address);
  fixture.componentRef.setInput('title', 'Shipping address');
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('OrderAddressBlock', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the heading, recipient, and display lines verbatim', () => {
    const { element } = setup();

    expect(element.querySelector('h2')?.textContent?.trim()).toBe('Shipping address');
    expect(element.textContent).toContain('Ada Lovelace');
    expect(element.textContent).toContain('1 Flux St');
    expect(element.textContent).toContain('Berlin, BE 10115');
    expect(element.textContent).toContain('DE');
    expect(element.querySelector('section')?.getAttribute('aria-label')).toBe('Shipping address');
  });

  it('renders no address rows beyond the projected lines', () => {
    const { element } = setup({ recipientName: 'Ada Lovelace', lines: ['1 Flux St'] });

    expect(element.querySelectorAll('address span')).toHaveLength(1);
  });
});
