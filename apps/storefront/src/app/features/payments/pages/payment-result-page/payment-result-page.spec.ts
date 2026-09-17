/**
 * Page tests for the Sub-Phase 9.2 `PaymentResultPage` shell.
 *
 * Covers the skeleton contract only: the page instantiates, renders the
 * status shell for a valid `:orderId`, and renders the missing reference
 * fallback without the shell for a blank id. No API, no state, no
 * outcome handling, no navigation is asserted here — those arrive in
 * Sub-Phases 9.3+.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { PaymentResultPage } from './payment-result-page';

const ORDER_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

function setup(orderId: string | null): {
  fixture: ComponentFixture<PaymentResultPage>;
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
  const fixture = TestBed.createComponent(PaymentResultPage);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('PaymentResultPage', () => {
  it('instantiates and renders the status shell', () => {
    const { fixture, element } = setup(ORDER_ID);
    expect(fixture.componentInstance).toBeTruthy();
    expect(element.textContent).toContain(ORDER_ID);
    expect(element.querySelector('payment-status')).not.toBeNull();
  });

  it('renders the missing-reference fallback without the shell for a blank id', () => {
    const { element } = setup(null);
    expect(element.querySelector('.payment-result-page-missing')).not.toBeNull();
    expect(element.querySelector('payment-status')).toBeNull();
  });
});
