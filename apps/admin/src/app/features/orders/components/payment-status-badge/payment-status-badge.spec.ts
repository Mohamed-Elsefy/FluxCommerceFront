import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CultureService } from '@flux/i18n';
import { PaymentStatusBadge } from './payment-status-badge';

function setup(status: string): {
  fixture: ComponentFixture<PaymentStatusBadge>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({});
  window.localStorage.clear();
  const fixture = TestBed.createComponent(PaymentStatusBadge);
  fixture.componentRef.setInput('status', status);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function badge(element: HTMLElement): HTMLElement | null {
  return element.querySelector('flux-badge .badge');
}

describe('PaymentStatusBadge', () => {
  it.each([
    ['Pending', 'Pending', 'info'],
    ['Processing', 'Processing', 'info'],
    ['Succeeded', 'Succeeded', 'success'],
    ['Failed', 'Failed', 'danger'],
    ['Cancelled', 'Cancelled', 'neutral'],
    ['Refunded', 'Refunded', 'warning'],
  ])('renders %s with its localized label and tone', (status, label, tone) => {
    const { element } = setup(status);

    expect(badge(element)?.textContent?.trim(), status).toBe(label);
    expect(badge(element)?.getAttribute('data-variant'), status).toBe(tone);
  });

  it('renders unknown backend values verbatim with the neutral tone', () => {
    const { element } = setup('Chargeback');

    expect(badge(element)?.textContent?.trim()).toBe('Chargeback');
    expect(badge(element)?.getAttribute('data-variant')).toBe('neutral');
  });

  it('never maps the order concept (order-only values stay verbatim)', () => {
    const { element } = setup('Confirmed');

    expect(badge(element)?.textContent?.trim()).toBe('Confirmed');
    expect(badge(element)?.getAttribute('data-variant')).toBe('neutral');
  });

  it('renders failed payments with the danger tone and no invented reason', () => {
    const { element } = setup('Failed');

    expect(badge(element)?.textContent?.trim()).toBe('Failed');
    expect(badge(element)?.getAttribute('data-variant')).toBe('danger');
    expect(element.textContent).not.toContain('reason');
  });

  it('renders the unknown label for blank statuses', () => {
    const { element } = setup('');

    expect(badge(element)?.textContent?.trim()).toBe('Unknown ()');
    expect(badge(element)?.getAttribute('data-variant')).toBe('neutral');
  });

  it.each(['fr', 'de', 'es', 'ar'] as const)('renders a non-empty label in %s', (culture) => {
    const { fixture, element } = setup('Failed');
    TestBed.inject(CultureService).setCulture(culture);
    try {
      fixture.detectChanges();

      expect(badge(element)?.textContent?.trim().length).toBeGreaterThan(0);
    } finally {
      TestBed.inject(CultureService).setCulture('en');
    }
  });

  it('localizes known statuses per culture', () => {
    const { fixture, element } = setup('Failed');
    TestBed.inject(CultureService).setCulture('fr');
    try {
      fixture.detectChanges();

      expect(badge(element)?.textContent?.trim()).toBe('Échoué');
    } finally {
      TestBed.inject(CultureService).setCulture('en');
    }
  });
});
