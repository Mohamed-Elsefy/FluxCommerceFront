import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { emptySpecFormValue, type SpecFormValue } from '../../models/catalog-admin.models';
import { SpecForm, type SpecFormCopy } from './spec-form';

const COPY: SpecFormCopy = {
  name: 'Name',
  value: 'Value',
  submit: 'Save specification',
  cancel: 'Cancel',
  saving: 'Saving…',
};

function setup(initial: SpecFormValue = emptySpecFormValue()): {
  fixture: ComponentFixture<SpecForm>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(SpecForm);
  fixture.componentRef.setInput('initial', initial);
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

describe('SpecForm', () => {
  it('renders both fields with actions', () => {
    const { element } = setup();

    expect(element.querySelector('#spec-name')).not.toBeNull();
    expect(element.querySelector('#spec-value')).not.toBeNull();
    expect(element.querySelector('admin-form-actions')).not.toBeNull();
  });

  it('emits the validated value on submit', () => {
    const { fixture, element } = setup();
    const seen: SpecFormValue[] = [];
    fixture.componentInstance.save.subscribe((value) => seen.push(value));

    fill(element, 'spec-name', 'Material');
    fill(element, 'spec-value', 'Cotton');
    fixture.detectChanges();
    (element.querySelector('.form-actions-submit') as HTMLButtonElement).click();

    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual({ name: 'Material', value: 'Cotton' });
  });

  it('blocks invalid submits without emitting', () => {
    const { fixture, element } = setup();
    const save = vi.fn();
    fixture.componentInstance.save.subscribe(save);

    fill(element, 'spec-name', 'Material');
    (element.querySelector('.form-actions-submit') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(save).not.toHaveBeenCalled();
  });

  it('projects server errors onto fields and reports unknown keys', () => {
    const { fixture, element } = setup();
    const unknown = fixture.componentInstance.applyServerErrors({
      Name: ['Taken.'],
      Mystery: ['No such field.'],
    });
    fixture.detectChanges();

    expect(unknown).toEqual(['Mystery']);
    expect(element.textContent).toContain('Taken.');
  });

  it('clears server errors while keeping the form usable', () => {
    const { fixture, element } = setup();
    fixture.componentInstance.applyServerErrors({ Value: ['Required.'] });
    fixture.detectChanges();
    expect(element.textContent).toContain('Required.');

    fixture.componentInstance.clearServerErrors();
    fixture.detectChanges();

    expect(element.textContent).not.toContain('Required.');
  });
});
