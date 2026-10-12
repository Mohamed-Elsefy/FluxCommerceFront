import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { Culture } from '@flux/i18n';
import { StatusBadge, type StatusBadgeDisplay } from './status-badge';

const UNKNOWN_KEY = 'test.status.unknown';

function displayOf(status: string | number): StatusBadgeDisplay {
  switch (String(status)) {
    case 'Active':
      return { labelKey: 'test.status.active', variant: 'success' };
    case 'Failed':
      return { labelKey: 'test.status.failed', variant: 'danger' };
    default:
      return { labelKey: UNKNOWN_KEY, variant: 'neutral' };
  }
}

function translateKey(culture: Culture, key: string, params: Record<string, string> = {}): string {
  void culture;
  return key === UNKNOWN_KEY ? `Unknown (${params['value'] ?? ''})` : `[${key}]`;
}

function setup(status: string | number): {
  fixture: ComponentFixture<StatusBadge<string | number>>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({});
  window.localStorage.clear();
  const fixture = TestBed.createComponent(StatusBadge<string | number>);
  fixture.componentRef.setInput('status', status);
  fixture.componentRef.setInput('displayOf', displayOf);
  fixture.componentRef.setInput('unknownLabelKey', UNKNOWN_KEY);
  fixture.componentRef.setInput('translateKey', translateKey);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function badge(element: HTMLElement): HTMLElement | null {
  return element.querySelector('flux-badge .badge');
}

describe('StatusBadge', () => {
  it('renders known values through the owner-provided map and resolver', () => {
    const { element } = setup('Active');

    expect(badge(element)?.textContent?.trim()).toBe('[test.status.active]');
    expect(badge(element)?.getAttribute('data-variant')).toBe('success');
  });

  it('renders unknown values verbatim with the neutral tone', () => {
    const { element } = setup('Chargeback');

    expect(badge(element)?.textContent?.trim()).toBe('Chargeback');
    expect(badge(element)?.getAttribute('data-variant')).toBe('neutral');
  });

  it('resolves the unknown entry for blank statuses', () => {
    const { element } = setup('');

    expect(badge(element)?.textContent?.trim()).toBe('Unknown ()');
    expect(badge(element)?.getAttribute('data-variant')).toBe('neutral');
  });

  it('presents numeric statuses verbatim when unknown', () => {
    const { element } = setup(7);

    expect(badge(element)?.textContent?.trim()).toBe('7');
    expect(badge(element)?.getAttribute('data-variant')).toBe('neutral');
  });
});
