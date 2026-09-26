import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_SERVER_ERROR_KEY, AdminFieldErrors } from './field-errors';

function setup(control: FormControl | null = null): {
  fixture: ComponentFixture<AdminFieldErrors>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({});
  window.localStorage.clear();
  const fixture = TestBed.createComponent(AdminFieldErrors);
  fixture.componentRef.setInput('control', control);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('AdminFieldErrors', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders nothing without a control or without errors', () => {
    expect(setup().element.querySelector('.field-errors')).toBeNull();

    TestBed.resetTestingModule();
    expect(setup(new FormControl('ok')).element.querySelector('.field-errors')).toBeNull();
  });

  it('renders localized messages once touched with errors', () => {
    const control = new FormControl('', { validators: [Validators.required] });
    const { fixture, element } = setup(control);
    expect(element.querySelector('.field-errors')).toBeNull();

    control.markAsTouched();
    fixture.detectChanges();

    expect(element.querySelector('.field-errors-message')?.textContent?.trim()).not.toBe('');
    expect(element.querySelector('.field-errors')?.getAttribute('role')).toBe('alert');
  });

  it('passes backend server messages through verbatim', () => {
    const control = new FormControl('x');
    control.setErrors({ [ADMIN_SERVER_ERROR_KEY]: ['Taken.'] });
    control.markAsTouched();
    const { element } = setup(control);

    expect(element.querySelector('.field-errors-message')?.textContent?.trim()).toBe('Taken.');
  });

  it('stays hidden for disabled controls', () => {
    const control = new FormControl('', { validators: [Validators.required] });
    control.markAsTouched();
    control.disable();
    const { element } = setup(control);

    expect(element.querySelector('.field-errors')).toBeNull();
  });
});
