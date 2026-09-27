import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { emptyCategoryFormValue, type CategoryFormValue } from '../../models/catalog-admin.models';
import { CategoryForm, type CategoryFormCopy } from './category-form';

const COPY: CategoryFormCopy = {
  name: 'Name',
  slug: 'Slug',
  slugHint: 'Hint',
  description: 'Description',
  parent: 'Parent category',
  submit: 'Save category',
  cancel: 'Cancel',
  saving: 'Saving…',
};

function setup(initial: CategoryFormValue = emptyCategoryFormValue()): {
  fixture: ComponentFixture<CategoryForm>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(CategoryForm);
  fixture.componentRef.setInput('initial', initial);
  fixture.componentRef.setInput('copy', COPY);
  fixture.componentRef.setInput('parents', [
    { value: '', label: 'No parent (top-level)' },
    { value: 'c0', label: 'Root' },
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

describe('CategoryForm', () => {
  it('renders every field with actions', () => {
    const { element } = setup();

    for (const id of [
      'category-name',
      'category-slug',
      'category-description',
      'category-parent',
    ]) {
      expect(element.querySelector(`#${id}`)).not.toBeNull();
    }
    expect(element.querySelector('admin-form-actions')).not.toBeNull();
  });

  it('emits the validated value on submit', () => {
    const { fixture, element } = setup();
    const seen: CategoryFormValue[] = [];
    fixture.componentInstance.save.subscribe((value) => seen.push(value));

    fill(element, 'category-name', 'Apparel');
    fill(element, 'category-slug', 'apparel');
    fill(element, 'category-parent', 'c0');
    fixture.detectChanges();
    (element.querySelector('.form-actions-submit') as HTMLButtonElement).click();

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ name: 'Apparel', slug: 'apparel', parentId: 'c0' });
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
      Slug: ['Slug is already used.'],
      ParentId: ['Parent is gone.'],
      Mystery: ['No such field.'],
    });
    fixture.detectChanges();

    expect(unknown).toEqual(['Mystery']);
    expect(element.textContent).toContain('Slug is already used.');
    expect(element.textContent).toContain('Parent is gone.');
  });

  it('clears server errors while keeping the form usable', () => {
    const { fixture, element } = setup();
    fixture.componentInstance.applyServerErrors({ Name: ['Taken.'] });
    fixture.detectChanges();
    expect(element.textContent).toContain('Taken.');

    fixture.componentInstance.clearServerErrors();
    fixture.detectChanges();

    expect(element.textContent).not.toContain('Taken.');
  });
});
