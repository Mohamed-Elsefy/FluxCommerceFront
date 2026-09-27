import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { emptyImageFormValue, type ImageFormValue } from '../../models/catalog-admin.models';
import { ImageForm, type ImageFormCopy, type ImageFormMode } from './image-form';

const COPY: ImageFormCopy = {
  url: 'Image URL',
  urlHint: 'URL hint',
  altText: 'Alternative text',
  order: 'Order',
  primary: 'Primary',
  submit: 'Save image',
  cancel: 'Cancel',
  saving: 'Saving…',
};

function setup(
  initial: ImageFormValue = emptyImageFormValue(),
  mode: ImageFormMode = 'create',
): { fixture: ComponentFixture<ImageForm>; element: HTMLElement } {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(ImageForm);
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

describe('ImageForm', () => {
  it('renders every field with the primary flag on add', () => {
    const { element } = setup();

    for (const id of ['image-url', 'image-alt', 'image-order']) {
      expect(element.querySelector(`#${id}`)).not.toBeNull();
    }
    expect(element.textContent).toContain('Primary');
    expect(element.querySelector('admin-form-actions')).not.toBeNull();
  });

  it('hides the primary flag when editing', () => {
    const { element } = setup(
      { url: '/images/tee.jpg', altText: null, order: '0', primary: false },
      'edit',
    );

    expect(element.textContent).not.toContain('Primary');
  });

  it('emits the validated value on submit', () => {
    const { fixture, element } = setup();
    const seen: ImageFormValue[] = [];
    fixture.componentInstance.save.subscribe((value) => seen.push(value));

    fill(element, 'image-url', '/images/tee.jpg');
    fill(element, 'image-order', '2');
    fixture.detectChanges();
    (element.querySelector('.form-actions-submit') as HTMLButtonElement).click();

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ url: '/images/tee.jpg', order: '2', primary: false });
  });

  it('blocks invalid submits without emitting', () => {
    const { fixture, element } = setup();
    const save = vi.fn();
    fixture.componentInstance.save.subscribe(save);

    fill(element, 'image-order', 'nope');
    (element.querySelector('.form-actions-submit') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(save).not.toHaveBeenCalled();
  });

  it('projects server errors onto fields and reports unknown keys', () => {
    const { fixture, element } = setup();
    const unknown = fixture.componentInstance.applyServerErrors({
      ImageUrl: ['URL is required.'],
      Mystery: ['No such field.'],
    });
    fixture.detectChanges();

    expect(unknown).toEqual(['Mystery']);
    expect(element.textContent).toContain('URL is required.');
  });

  it('clears server errors while keeping the form usable', () => {
    const { fixture, element } = setup();
    fixture.componentInstance.applyServerErrors({ DisplayOrder: ['Bad order.'] });
    fixture.detectChanges();
    expect(element.textContent).toContain('Bad order.');

    fixture.componentInstance.clearServerErrors();
    fixture.detectChanges();

    expect(element.textContent).not.toContain('Bad order.');
  });
});
