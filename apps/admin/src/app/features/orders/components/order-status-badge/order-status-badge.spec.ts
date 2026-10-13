import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CultureService } from '@flux/i18n';
import { OrderStatusBadge } from './order-status-badge';

function setup(status: string): {
  fixture: ComponentFixture<OrderStatusBadge>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({});
  window.localStorage.clear();
  const fixture = TestBed.createComponent(OrderStatusBadge);
  fixture.componentRef.setInput('status', status);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function badge(element: HTMLElement): HTMLElement | null {
  return element.querySelector('flux-badge .badge');
}

describe('OrderStatusBadge', () => {
  it.each([
    ['Pending', 'Pending', 'info'],
    ['Cancelled', 'Cancelled', 'danger'],
    ['Confirmed', 'Confirmed', 'success'],
  ])('renders %s with its localized label and tone', (status, label, tone) => {
    const { element } = setup(status);

    expect(badge(element)?.textContent?.trim(), status).toBe(label);
    expect(badge(element)?.getAttribute('data-variant'), status).toBe(tone);
  });

  it('renders unknown backend values verbatim with the neutral tone', () => {
    const { element } = setup('Shipped');

    expect(badge(element)?.textContent?.trim()).toBe('Shipped');
    expect(badge(element)?.getAttribute('data-variant')).toBe('neutral');
  });

  it('never maps the payment concept (payment-only values stay verbatim)', () => {
    const { element } = setup('Succeeded');

    expect(badge(element)?.textContent?.trim()).toBe('Succeeded');
    expect(badge(element)?.getAttribute('data-variant')).toBe('neutral');
  });

  it('renders the unknown label for blank statuses', () => {
    const { element } = setup('');

    expect(badge(element)?.textContent?.trim()).toBe('Unknown ()');
    expect(badge(element)?.getAttribute('data-variant')).toBe('neutral');
  });

  it.each(['fr', 'de', 'es', 'ar'] as const)('renders a non-empty label in %s', (culture) => {
    const { fixture, element } = setup('Pending');
    TestBed.inject(CultureService).setCulture(culture);
    try {
      fixture.detectChanges();

      expect(badge(element)?.textContent?.trim().length).toBeGreaterThan(0);
    } finally {
      TestBed.inject(CultureService).setCulture('en');
    }
  });

  it('localizes known statuses per culture', () => {
    const { fixture, element } = setup('Confirmed');
    TestBed.inject(CultureService).setCulture('fr');
    try {
      fixture.detectChanges();

      expect(badge(element)?.textContent?.trim()).toBe('Confirmée');
    } finally {
      TestBed.inject(CultureService).setCulture('en');
    }
  });
});
