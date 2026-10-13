import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { AdminTextInput } from './text-input';

function setup(): { fixture: ComponentFixture<AdminTextInput>; element: HTMLElement } {
  TestBed.configureTestingModule({});
  window.localStorage.clear();
  const fixture = TestBed.createComponent(AdminTextInput);
  fixture.componentRef.setInput('control', new FormControl('', [Validators.required]));
  fixture.componentRef.setInput('label', 'Name');
  fixture.componentRef.setInput('fieldId', 'name');
  fixture.componentRef.setInput('hint', 'Public name');
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('AdminTextInput', () => {
  it('associates the label and reflects the control state', () => {
    const { fixture, element } = setup();
    const input = element.querySelector('input.text-input') as HTMLInputElement;

    expect(element.querySelector('label')?.getAttribute('for')).toBe('name');
    expect(input.getAttribute('aria-invalid')).toBe('true');

    input.value = 'x';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.control.value).toBe('x');
  });

  it('surfaces validation messages and disabled state', () => {
    const { fixture, element } = setup();
    const instance = fixture.componentInstance;
    instance.control.markAsTouched();
    instance.control.disable();
    fixture.detectChanges();

    expect(element.querySelector('input.text-input')?.hasAttribute('disabled')).toBe(true);
    expect(element.querySelector('.field-errors')).toBeNull();

    instance.control.enable();
    fixture.detectChanges();

    expect(element.querySelector('.field-errors-message')?.textContent?.trim()).not.toBe('');
  });
});
