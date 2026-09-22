/**
 * Component tests for the Sub-Phase 10.5 `OrderStatusBadge`.
 *
 * Covers the presentational contract only (localized labels, tone
 * classes, unknown-value fallback, text-not-color conveyance):
 * tone mappings stay in `status.models.spec.ts`, backend shapes in
 * `@flux/models` specs.
 *
 * Decoupling pin: a payment-only value renders raw with the neutral
 * tone — the order badge never maps the payment concept.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CultureService } from '@flux/i18n';
import { OrderStatusBadge } from './order-status-badge';

function setup(status: string): {
  fixture: ComponentFixture<OrderStatusBadge>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(OrderStatusBadge);
  fixture.componentRef.setInput('status', status);
  TestBed.inject(CultureService).setCulture('en');
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function badge(element: HTMLElement): HTMLElement | null {
  return element.querySelector('span.status-badge');
}

describe('OrderStatusBadge', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders known statuses with localized labels and tones', () => {
    const cases: ReadonlyArray<readonly [string, string, string]> = [
      ['Pending', 'Pending', 'tone-info'],
      ['Confirmed', 'Confirmed', 'tone-success'],
      ['Cancelled', 'Cancelled', 'tone-danger'],
    ];
    for (const [status, label, tone] of cases) {
      const { element } = setup(status);
      expect(badge(element)?.textContent?.trim(), status).toBe(label);
      expect(badge(element)?.className, status).toContain(tone);
      TestBed.resetTestingModule();
    }
  });

  it('renders unknown backend values verbatim with the neutral tone', () => {
    const { element } = setup('Shipped');

    expect(badge(element)?.textContent?.trim()).toBe('Shipped');
    expect(badge(element)?.className).toContain('tone-neutral');
  });

  it('renders the unknown-status note for blank input', () => {
    const { element } = setup('   ');

    expect(badge(element)?.textContent?.trim()).toBe('Unknown order status');
    expect(badge(element)?.className).toContain('tone-neutral');
  });

  it('never maps payment-only values (cross-concept independence)', () => {
    const { element } = setup('Succeeded');

    expect(badge(element)?.textContent?.trim()).toBe('Succeeded');
    expect(badge(element)?.className).toContain('tone-neutral');
  });

  it('always conveys status as text (never color-only)', () => {
    const { element } = setup('Pending');

    expect(badge(element)?.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('localizes labels with the active culture', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(OrderStatusBadge);
    fixture.componentRef.setInput('status', 'Confirmed');
    TestBed.inject(CultureService).setCulture('fr');
    fixture.detectChanges();

    expect(badge(fixture.nativeElement as HTMLElement)?.textContent?.trim()).toBe('Confirmée');

    TestBed.inject(CultureService).setCulture('en');
  });
});
