/**
 * Component tests for the Sub-Phase 9.2 `PaymentLoadingComponent` shell.
 *
 * Covers the presentational contract only: the shell instantiates
 * through the shared loading indicator with the default label, and a
 * page-supplied label projects. No API, no state, no loading logic is
 * asserted here — those arrive in Sub-Phases 9.3/9.4.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PaymentLoadingComponent } from './payment-loading';

function setup(): { fixture: ComponentFixture<PaymentLoadingComponent>; element: HTMLElement } {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(PaymentLoadingComponent);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('PaymentLoadingComponent', () => {
  it('instantiates with the default label', () => {
    const { fixture, element } = setup();
    expect(fixture.componentInstance).toBeTruthy();
    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();
    expect(element.textContent).toContain('Loading payment…');
  });

  it('projects a page-supplied label', () => {
    const { fixture, element } = setup();
    fixture.componentRef.setInput('label', 'Confirming payment…');
    fixture.detectChanges();
    expect(element.textContent).toContain('Confirming payment…');
  });
});
