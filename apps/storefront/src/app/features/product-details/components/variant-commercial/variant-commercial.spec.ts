/**
 * Component tests for the `VariantCommercial` (Sub-Phase 6.5 — SKU
 * Binding).
 *
 * Covers the presentational contract only (selection state lives in
 * `ProductDetailsState`, covered by `product-details-state.spec.ts`):
 * SKU binding to the selected variant, instant updates on variant
 * switches, the no-selection prompt, the unavailable notice for
 * no-longer-selectable variants, and the contract surface pin — the
 * section renders exactly one commercial row (SKU), so fabricated
 * price/availability content would fail loudly here.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { VariantStatus } from '@flux/models';
import type { ProductVariant } from '../../models/product-details.models';
import { VariantCommercial } from './variant-commercial';

const PRODUCT_ID = '11111111-1111-1111-1111-111111111111';

function variant(id: string, sku: string, overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id,
    productId: PRODUCT_ID,
    sku,
    name: `Name ${sku}`,
    status: VariantStatus.Active,
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
    ...overrides,
  };
}

const ACTIVE = variant('aaaaaaaa-1111-4111-8111-111111111111', 'TEE-RED-M');
const OTHER = variant('bbbbbbbb-2222-4222-8222-222222222222', 'TEE-BLUE-M');
const INACTIVE = variant('cccccccc-3333-4333-8333-333333333333', 'TEE-GREEN-M', {
  status: VariantStatus.Inactive,
});

function setup(options: { variant?: ProductVariant | null } = {}): {
  fixture: ComponentFixture<VariantCommercial>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(VariantCommercial);
  fixture.componentRef.setInput('variant', options.variant ?? null);
  fixture.componentRef.setInput('title', 'Variant details');
  fixture.componentRef.setInput('skuLabel', 'SKU');
  fixture.componentRef.setInput('selectPrompt', 'Select a variant to see its details.');
  fixture.componentRef.setInput('unavailableMessage', 'This variant is no longer available.');
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('VariantCommercial binding', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the selected variant SKU as the single commercial row', () => {
    const { element } = setup({ variant: ACTIVE });
    const rows = [...element.querySelectorAll('.variant-commercial-row')];

    expect(rows).toHaveLength(1);
    expect(rows[0]?.querySelector('dt')?.textContent).toBe('SKU');
    expect(rows[0]?.querySelector('dd')?.textContent).toBe('TEE-RED-M');
  });

  it('updates instantly on variant switches with no stale data', () => {
    const { element, fixture } = setup({ variant: ACTIVE });
    expect(element.querySelector('.variant-commercial-row dd')?.textContent).toBe('TEE-RED-M');

    fixture.componentRef.setInput('variant', OTHER);
    fixture.detectChanges();

    const rows = [...element.querySelectorAll('.variant-commercial-row')];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.querySelector('dd')?.textContent).toBe('TEE-BLUE-M');
    expect(element.textContent).not.toContain('TEE-RED-M');
  });

  it('renders the prompt when no variant is selected', () => {
    const { element } = setup({ variant: null });

    expect(element.querySelector('.variant-commercial-prompt')?.textContent).toBe(
      'Select a variant to see its details.',
    );
    expect(element.querySelector('.variant-commercial-list')).toBeNull();
  });

  it('renders the unavailable notice for no-longer-selectable variants', () => {
    const { element } = setup({ variant: INACTIVE });
    const notice = element.querySelector('.variant-commercial-unavailable');

    expect(notice?.textContent).toBe('This variant is no longer available.');
    expect(notice?.getAttribute('role')).toBe('alert');
    expect(element.querySelector('.variant-commercial-list')).toBeNull();
  });
});
