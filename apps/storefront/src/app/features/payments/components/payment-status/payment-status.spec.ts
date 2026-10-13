/**
 * Component tests for the Sub-Phase 9.2 `PaymentStatusComponent` shell.
 *
 * Covers the presentational contract only: the shell renders, a known
 * status projects verbatim (no mapping, no derivation), and a missing
 * status renders the waiting shell. No API, no polling, no result
 * handling is asserted here — those arrive in Sub-Phases 9.4/9.8.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PaymentStatusComponent } from './payment-status';

function setup(): { fixture: ComponentFixture<PaymentStatusComponent>; element: HTMLElement } {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(PaymentStatusComponent);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('PaymentStatusComponent', () => {
  it('instantiates the status shell with the waiting placeholder', () => {
    const { fixture, element } = setup();
    expect(fixture.componentInstance).toBeTruthy();
    expect(element.querySelector('.payment-status-waiting')).not.toBeNull();
    expect(element.querySelector('.payment-status-value')).toBeNull();
  });

  it('projects a backend status verbatim', () => {
    const { fixture, element } = setup();
    fixture.componentRef.setInput('status', 'Processing');
    fixture.detectChanges();
    expect(element.querySelector('.payment-status-value')?.textContent?.trim()).toBe('Processing');
    expect(element.querySelector('.payment-status-waiting')).toBeNull();
  });

  it('exposes the status region to assistive technology', () => {
    const { element } = setup();
    expect(element.querySelector('.payment-status')?.getAttribute('role')).toBe('status');
  });
});
