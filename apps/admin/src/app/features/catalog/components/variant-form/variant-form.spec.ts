import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { emptyVariantFormValue, type VariantFormValue } from '../../models/catalog-admin.models';
import { VariantForm, type VariantFormCopy, type VariantFormMode } from './variant-form';

const COPY: VariantFormCopy = {
  sku: 'SKU',
  name: 'Name',
  price: 'Price',
  currency: 'Currency',
  currencyHint: 'Three letters.',
  priceLockedHint: 'Set at creation.',
  submit: 'Save variant',
  cancel: 'Cancel',
  saving: 'Saving…',
};

function setup(
  initial: VariantFormValue = emptyVariantFormValue(),
  mode: VariantFormMode = 'create',
): { fixture: ComponentFixture<VariantForm>; element: HTMLElement } {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(VariantForm);
  fixture.componentRef.setInput('initial', initial);
  fixture.componentRef.setInput('mode', mode);
  fixture.componentRef.setInput('copy', COPY);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function fill(element: HTMLElement, id: string, value: string): void {
  const input = element.querySelector(`#${id}`) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('change'));
}

describe('VariantForm', () => {
  it('renders every field with actions', () => {
    const { element } = setup();

    for (const id of ['variant-sku', 'variant-name', 'variant-price', 'variant-currency']) {
      expect(element.querySelector(`#${id}`)).not.toBeNull();
    }
    expect(element.querySelector('admin-form-actions')).not.toBeNull();
  });

  it('emits the validated value on submit', () => {
    const { fixture, element } = setup();
    const seen: VariantFormValue[] = [];
    fixture.componentInstance.save.subscribe((value) => seen.push(value));

    fill(element, 'variant-sku', 'TEE-BLK-M');
    fill(element, 'variant-name', 'Black / M');
    fill(element, 'variant-price', '29.99');
    fill(element, 'variant-currency', 'USD');
    fixture.detectChanges();
    (element.querySelector('.form-actions-submit') as HTMLButtonElement).click();

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      sku: 'TEE-BLK-M',
      price: '29.99',
      currency: 'USD',
    });
  });

  it('blocks invalid submits without emitting', () => {
    const { fixture, element } = setup();
    const save = vi.fn();
    fixture.componentInstance.save.subscribe(save);

    fill(element, 'variant-price', 'not-a-number');
    (element.querySelector('.form-actions-submit') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(save).not.toHaveBeenCalled();
  });

  it('locks money controls as read-only display when editing', () => {
    const { element } = setup(
      { sku: 'TEE-BLK-M', name: 'Black / M', price: '29.99', currency: 'USD' },
      'edit',
    );

    expect((element.querySelector('#variant-price') as HTMLInputElement).disabled).toBe(true);
    expect((element.querySelector('#variant-currency') as HTMLInputElement).disabled).toBe(true);
    expect((element.querySelector('#variant-sku') as HTMLInputElement).disabled).toBe(false);
    expect(element.textContent).toContain('Set at creation.');
  });

  it('projects server errors onto fields and reports unknown keys', () => {
    const { fixture, element } = setup();
    const unknown = fixture.componentInstance.applyServerErrors({
      Sku: ['SKU is already used.'],
      Mystery: ['No such field.'],
    });
    fixture.detectChanges();

    expect(unknown).toEqual(['Mystery']);
    expect(element.textContent).toContain('SKU is already used.');
  });

  it('clears server errors while keeping the form usable', () => {
    const { fixture, element } = setup();
    fixture.componentInstance.applyServerErrors({ Currency: ['Unknown currency.'] });
    fixture.detectChanges();
    expect(element.textContent).toContain('Unknown currency.');

    fixture.componentInstance.clearServerErrors();
    fixture.detectChanges();

    expect(element.textContent).not.toContain('Unknown currency.');
  });
});
