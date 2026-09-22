/**
 * Component tests for the Sub-Phase 10.5 `PaymentStatusBadge`.
 *
 * Covers the presentational contract only (localized labels, tone
 * classes, unknown-value fallback, text-not-color conveyance):
 * tone mappings stay in `status.models.spec.ts`, backend shapes in
 * `@flux/models` specs.
 *
 * Decoupling pin: an order-only value renders raw with the neutral
 * tone — the payment badge never maps the order concept, and a
 * successful payment is never presented as a completed order.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CultureService } from '@flux/i18n';
import { PaymentStatusBadge } from './payment-status-badge';

function setup(status: string): {
  fixture: ComponentFixture<PaymentStatusBadge>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(PaymentStatusBadge);
  fixture.componentRef.setInput('status', status);
  TestBed.inject(CultureService).setCulture('en');
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function badge(element: HTMLElement): HTMLElement | null {
  return element.querySelector('span.status-badge');
}

describe('PaymentStatusBadge', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders known statuses with localized labels and tones', () => {
    const cases: ReadonlyArray<readonly [string, string, string]> = [
      ['Pending', 'Pending', 'tone-info'],
      ['Processing', 'Processing', 'tone-info'],
      ['Succeeded', 'Succeeded', 'tone-success'],
      ['Failed', 'Failed', 'tone-danger'],
      ['Cancelled', 'Cancelled', 'tone-neutral'],
      ['Refunded', 'Refunded', 'tone-warning'],
    ];
    for (const [status, label, tone] of cases) {
      const { element } = setup(status);
      expect(badge(element)?.textContent?.trim(), status).toBe(label);
      expect(badge(element)?.className, status).toContain(tone);
      TestBed.resetTestingModule();
    }
  });

  it('renders unknown backend values verbatim with the neutral tone', () => {
    const { element } = setup('Reversed');

    expect(badge(element)?.textContent?.trim()).toBe('Reversed');
    expect(badge(element)?.className).toContain('tone-neutral');
  });

  it('renders the unknown-status note for blank input', () => {
    const { element } = setup('');

    expect(badge(element)?.textContent?.trim()).toBe('Unknown payment status');
    expect(badge(element)?.className).toContain('tone-neutral');
  });

  it('never maps order-only values (cross-concept independence)', () => {
    const { element } = setup('Confirmed');

    expect(badge(element)?.textContent?.trim()).toBe('Confirmed');
    expect(badge(element)?.className).toContain('tone-neutral');
  });

  it('always conveys status as text (never color-only)', () => {
    const { element } = setup('Succeeded');

    expect(badge(element)?.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('localizes labels with the active culture', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(PaymentStatusBadge);
    fixture.componentRef.setInput('status', 'Succeeded');
    TestBed.inject(CultureService).setCulture('de');
    fixture.detectChanges();

    expect(badge(fixture.nativeElement as HTMLElement)?.textContent?.trim()).toBe('Erfolgreich');

    TestBed.inject(CultureService).setCulture('en');
  });
});
