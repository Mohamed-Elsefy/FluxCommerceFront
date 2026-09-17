/**
 * Component tests for the Sub-Phase 9.2 `PaymentFormComponent` shell.
 *
 * Covers the presentational contract only: the shell renders, the submit
 * label projects, the disabled input gates the button, and submit clicks
 * emit (the page owns what submission does — 9.7). No API, no Stripe, no
 * state behavior is asserted here.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PaymentFormComponent } from './payment-form';

function setup(): { fixture: ComponentFixture<PaymentFormComponent>; element: HTMLElement } {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(PaymentFormComponent);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('PaymentFormComponent', () => {
  it('instantiates the form shell', () => {
    const { fixture, element } = setup();
    expect(fixture.componentInstance).toBeTruthy();
    expect(element.querySelector('.payment-form')).not.toBeNull();
  });

  it('renders the default submit label', () => {
    const { element } = setup();
    expect(element.querySelector('.payment-form-submit')?.textContent?.trim()).toBe('Pay');
  });

  it('projects a page-supplied submit label', () => {
    const { fixture, element } = setup();
    fixture.componentRef.setInput('submitLabel', 'Pay now');
    fixture.detectChanges();
    expect(element.querySelector('.payment-form-submit')?.textContent?.trim()).toBe('Pay now');
  });

  it('enables submission by default and disables on input', () => {
    const { fixture, element } = setup();
    expect((element.querySelector('.payment-form-submit') as HTMLButtonElement).disabled).toBe(
      false,
    );
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect((element.querySelector('.payment-form-submit') as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('emits on submit click', () => {
    const { fixture, element } = setup();
    let emitted = 0;
    fixture.componentInstance.formSubmit.subscribe(() => {
      emitted += 1;
    });
    (element.querySelector('.payment-form-submit') as HTMLButtonElement).click();
    expect(emitted).toBe(1);
  });
});
