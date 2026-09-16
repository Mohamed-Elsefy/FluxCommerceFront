/**
 * Component tests for the `VariantSelector` (Sub-Phase 6.4 — Variant
 * Selection).
 *
 * Covers the presentational contract only (selection state lives in
 * `ProductDetailsState`, covered by `product-details-state.spec.ts`):
 * backend-name rendering without fabricated fields, selection emission,
 * pressed-state communication, disabled handling of inactive/deleted
 * variants with the unavailable note, emit-guard defense in depth, and
 * keyboard-operable native controls.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VariantStatus } from '@flux/models';
import type { ProductVariant } from '../../models/product-details.models';
import { VariantSelector } from './variant-selector';

const PRODUCT_ID = '11111111-1111-1111-1111-111111111111';

function variant(
  id: string,
  name: string,
  overrides: Partial<ProductVariant> = {},
): ProductVariant {
  return {
    id,
    productId: PRODUCT_ID,
    sku: `SKU-${id}`,
    name,
    unitPriceAmount: 29.99,
    currency: 'USD',
    status: VariantStatus.Active,
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
    ...overrides,
  };
}

const VARIANTS: readonly ProductVariant[] = [
  variant('aaaaaaaa-1111-4111-8111-111111111111', 'Red / M'),
  variant('bbbbbbbb-2222-4222-8222-222222222222', 'Blue / M', {
    status: VariantStatus.Inactive,
  }),
  variant('cccccccc-3333-4333-8333-333333333333', 'Green / M', { isDeleted: true }),
];

function setup(options: {
  variants?: readonly ProductVariant[];
  selectedVariantId?: string | null;
}): { fixture: ComponentFixture<VariantSelector>; element: HTMLElement; emitted: string[] } {
  const emitted: string[] = [];
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(VariantSelector);
  fixture.componentRef.setInput('variants', options.variants ?? VARIANTS);
  fixture.componentRef.setInput('selectedVariantId', options.selectedVariantId ?? null);
  fixture.componentRef.setInput('label', 'Variant');
  fixture.componentRef.setInput('unavailableLabel', 'Unavailable');
  fixture.componentInstance.selectionChange.subscribe((id: string) => emitted.push(id));
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement, emitted };
}

describe('VariantSelector rendering', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders one option per backend variant with backend names only', () => {
    const { element } = setup({});
    const names = [...element.querySelectorAll('.variant-selector-name')].map((name) =>
      name.textContent?.trim(),
    );

    expect(names).toEqual(['Red / M', 'Blue / M', 'Green / M']);
    expect(element.textContent).not.toContain('SKU-');
  });

  it('disables inactive and deleted variants with the unavailable note', () => {
    const { element } = setup({});
    const buttons = [...element.querySelectorAll('.variant-selector-option')];

    expect(buttons[0]?.hasAttribute('disabled')).toBe(false);
    expect(buttons[1]?.hasAttribute('disabled')).toBe(true);
    expect(buttons[2]?.hasAttribute('disabled')).toBe(true);
    expect(
      [...element.querySelectorAll('.variant-selector-unavailable')].map((note) =>
        note.textContent?.trim(),
      ),
    ).toEqual(['Unavailable', 'Unavailable']);
  });

  it('marks the selected variant as pressed', () => {
    const { element } = setup({ selectedVariantId: 'aaaaaaaa-1111-4111-8111-111111111111' });
    const buttons = [...element.querySelectorAll('.variant-selector-option')];

    expect(buttons[0]?.getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1]?.getAttribute('aria-pressed')).toBe('false');
    expect(buttons[2]?.getAttribute('aria-pressed')).toBe('false');
  });

  it('renders no options for an empty list', () => {
    const { element } = setup({ variants: [] });

    expect(element.querySelectorAll('.variant-selector-option')).toHaveLength(0);
  });
});

describe('VariantSelector selection', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('emits the variant id for a selectable option', () => {
    const { element, fixture, emitted } = setup({});

    [...element.querySelectorAll('.variant-selector-option')][0]?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(emitted).toEqual(['aaaaaaaa-1111-4111-8111-111111111111']);
  });

  it('never emits for unselectable options (emit-guard defense in depth)', () => {
    const { fixture, emitted } = setup({});
    const component = fixture.componentInstance;
    const select = vi.spyOn(component.selectionChange, 'emit');

    component.selectVariant(VARIANTS[1]!);
    component.selectVariant(VARIANTS[2]!);

    expect(select).not.toHaveBeenCalled();
    expect(emitted).toEqual([]);
  });

  it('exposes options as keyboard-operable native buttons', () => {
    const { element } = setup({});
    const buttons = [...element.querySelectorAll('.variant-selector-option')];

    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      expect(button.tagName).toBe('BUTTON');
      expect(button.getAttribute('type')).toBe('button');
    }
  });
});
