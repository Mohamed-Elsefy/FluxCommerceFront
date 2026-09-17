/**
 * Component tests for the Sub-Phase 9.2 `PaymentErrorComponent` shell.
 *
 * Covers the presentational contract only: nothing renders without a
 * message, a message projects through the shared error state, and retry
 * clicks emit (the page owns what retry does — 9.9). No API, no error
 * classification, no retry execution is asserted here.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PaymentErrorComponent } from './payment-error';

function setup(): { fixture: ComponentFixture<PaymentErrorComponent>; element: HTMLElement } {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(PaymentErrorComponent);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('PaymentErrorComponent', () => {
  it('instantiates and renders nothing without a message', () => {
    const { fixture, element } = setup();
    expect(fixture.componentInstance).toBeTruthy();
    expect(element.querySelector('flux-error-state')).toBeNull();
  });

  it('projects the message through the shared error state', () => {
    const { fixture, element } = setup();
    fixture.componentRef.setInput('message', 'Payment failed. Try again.');
    fixture.detectChanges();
    const error = element.querySelector('flux-error-state');
    expect(error).not.toBeNull();
    expect(error?.textContent).toContain('Payment failed. Try again.');
  });

  it('emits on retry click', () => {
    const { fixture, element } = setup();
    fixture.componentRef.setInput('message', 'Payment failed. Try again.');
    fixture.detectChanges();
    let emitted = 0;
    fixture.componentInstance.retry.subscribe(() => {
      emitted += 1;
    });
    (element.querySelector('button.retry') as HTMLButtonElement)?.click();
    expect(emitted).toBe(1);
  });
});
