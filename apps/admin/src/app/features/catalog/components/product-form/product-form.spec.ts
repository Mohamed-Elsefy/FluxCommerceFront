import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { emptyProductFormValue, type ProductFormValue } from '../../models/catalog-admin.models';
import { ProductForm, type ProductFormCopy } from './product-form';

const COPY: ProductFormCopy = {
  name: 'Name',
  slug: 'Slug',
  slugHint: 'Hint',
  description: 'Description',
  category: 'Category',
  visibility: 'Visibility',
  seoTitle: 'SEO title',
  seoDescription: 'SEO description',
  seoKeywords: 'SEO keywords',
  seoKeywordsHint: 'Comma-separated.',
  submit: 'Save product',
  cancel: 'Cancel',
  saving: 'Saving…',
};

function setup(initial: ProductFormValue = emptyProductFormValue()): {
  fixture: ComponentFixture<ProductForm>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(ProductForm);
  fixture.componentRef.setInput('initial', initial);
  fixture.componentRef.setInput('copy', COPY);
  fixture.componentRef.setInput('categories', [
    { value: '', label: 'Select…' },
    { value: 'cat-1', label: 'Alpha' },
  ]);
  fixture.componentRef.setInput('visibilityOptions', [
    { value: '', label: 'Select…' },
    { value: '0', label: 'Visible' },
  ]);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function fill(element: HTMLElement, id: string, value: string): void {
  const input = element.querySelector(`#${id}`) as HTMLInputElement | HTMLSelectElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('change'));
}

describe('ProductForm', () => {
  it('renders every field with actions', () => {
    const { element } = setup();

    for (const id of [
      'product-name',
      'product-slug',
      'product-description',
      'product-category',
      'product-visibility',
      'product-seo-title',
      'product-seo-description',
      'product-seo-keywords',
    ]) {
      expect(element.querySelector(`#${id}`)).not.toBeNull();
    }
    expect(element.querySelector('admin-form-actions')).not.toBeNull();
  });

  it('emits the validated value on submit', () => {
    const { fixture, element } = setup();
    const seen: ProductFormValue[] = [];
    fixture.componentInstance.save.subscribe((value) => seen.push(value));

    fill(element, 'product-name', 'Tee');
    fill(element, 'product-slug', 'tee');
    fill(element, 'product-category', 'cat-1');
    fill(element, 'product-visibility', '0');
    fixture.detectChanges();
    (element.querySelector('.form-actions-submit') as HTMLButtonElement).click();

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ name: 'Tee', slug: 'tee', visibility: '0' });
  });

  it('blocks invalid submits without emitting', () => {
    const { fixture, element } = setup();
    const save = vi.fn();
    fixture.componentInstance.save.subscribe(save);

    (element.querySelector('.form-actions-submit') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(save).not.toHaveBeenCalled();
  });

  it('projects server errors onto fields and reports unknown keys', () => {
    const { fixture, element } = setup();
    const unknown = fixture.componentInstance.applyServerErrors({
      Name: ['Name is required.'],
      'Seo.Title': ['Too long.'],
      Mystery: ['No such field.'],
    });
    fixture.detectChanges();

    expect(unknown).toEqual(['Mystery']);
    expect(element.textContent).toContain('Name is required.');
    expect(element.textContent).toContain('Too long.');
  });

  it('clears server errors while keeping the form usable', () => {
    const { fixture, element } = setup();
    fixture.componentInstance.applyServerErrors({ Slug: ['Taken.'] });
    fixture.detectChanges();
    expect(element.textContent).toContain('Taken.');

    fixture.componentInstance.clearServerErrors();
    fixture.detectChanges();

    expect(element.textContent).not.toContain('Taken.');
  });
});
