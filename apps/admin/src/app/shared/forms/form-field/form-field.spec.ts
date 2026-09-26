import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { AdminFormField } from './form-field';

@Component({
  selector: 'admin-form-field-host',
  imports: [ReactiveFormsModule, AdminFormField],
  template: `<admin-form-field label="Name" fieldId="name" hint="Public name" [control]="control">
    <input id="name" [formControl]="control" />
  </admin-form-field>`,
})
class FormFieldHost {
  readonly control = new FormControl('', { validators: [Validators.required] });
}

function setup(): { fixture: ComponentFixture<FormFieldHost>; element: HTMLElement } {
  TestBed.configureTestingModule({});
  window.localStorage.clear();
  const fixture = TestBed.createComponent(FormFieldHost);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('AdminFormField', () => {
  it('associates the label, projects the control, and shows the hint', () => {
    const { element } = setup();

    expect(element.querySelector('label.form-field-label')?.textContent?.trim()).toBe('Name');
    expect(element.querySelector('label.form-field-label')?.getAttribute('for')).toBe('name');
    expect(element.querySelector('input#name')).not.toBeNull();
    expect(element.querySelector('.form-field-hint')?.textContent).toBe('Public name');
    expect(element.querySelector('.field-errors')).toBeNull();
  });

  it('surfaces control validation messages through the shared errors', () => {
    const { fixture, element } = setup();

    fixture.componentInstance.control.markAsTouched();
    fixture.detectChanges();

    expect(element.querySelector('.field-errors-message')?.textContent?.trim()).not.toBe('');
  });
});
