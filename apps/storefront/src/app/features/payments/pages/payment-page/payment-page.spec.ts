/**
 * Page tests for the Sub-Phase 9.2 `PaymentPage` shell.
 *
 * Covers the skeleton contract only: the page instantiates, composes all
 * four foundation shells for a valid `:orderId`, and renders the missing
 * reference fallback without shells for a blank id. No API, no state, no
 * provider, no navigation behavior is asserted here — those arrive in
 * Sub-Phases 9.3+.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { PaymentPage } from './payment-page';

const ORDER_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

function setup(orderId: string | null): {
  fixture: ComponentFixture<PaymentPage>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            paramMap: orderId === null ? convertToParamMap({}) : convertToParamMap({ orderId }),
          },
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(PaymentPage);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('PaymentPage', () => {
  it('instantiates and composes the four foundation shells', () => {
    const { fixture, element } = setup(ORDER_ID);
    expect(fixture.componentInstance).toBeTruthy();
    expect(element.textContent).toContain(ORDER_ID);
    expect(element.querySelector('payment-form')).not.toBeNull();
    expect(element.querySelector('payment-status')).not.toBeNull();
    expect(element.querySelector('payment-error')).not.toBeNull();
    expect(element.querySelector('payment-loading')).not.toBeNull();
  });

  it('renders the missing-reference fallback without shells for a blank id', () => {
    const { element } = setup(null);
    expect(element.querySelector('.payment-page-missing')).not.toBeNull();
    expect(element.querySelector('payment-form')).toBeNull();
    expect(element.querySelector('payment-status')).toBeNull();
    expect(element.querySelector('payment-error')).toBeNull();
    expect(element.querySelector('payment-loading')).toBeNull();
  });
});
