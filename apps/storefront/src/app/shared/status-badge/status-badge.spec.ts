import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { StorefrontStatusBadge } from './status-badge';

const TONES: Record<string, string> = {
  Active: 'success',
  Failed: 'danger',
};

const LABEL_KEYS: Record<string, string> = {
  Active: 'test.status.active',
  Failed: 'test.status.failed',
};

const UNKNOWN_KEY = 'test.status.unknown';

function setup(status: string): {
  fixture: ComponentFixture<StorefrontStatusBadge>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({});
  window.localStorage.clear();
  const fixture = TestBed.createComponent(StorefrontStatusBadge);
  fixture.componentRef.setInput('status', status);
  fixture.componentRef.setInput('toneOf', (value: string) => TONES[value] ?? 'neutral');
  fixture.componentRef.setInput('labelKeyOf', (value: string) => LABEL_KEYS[value] ?? null);
  fixture.componentRef.setInput('unknownLabelKey', UNKNOWN_KEY);
  fixture.componentRef.setInput('translateKey', (_culture: unknown, key: string) =>
    key === UNKNOWN_KEY ? 'Unknown' : `[${key}]`,
  );
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function badge(element: HTMLElement): HTMLElement | null {
  return element.querySelector('span.status-badge');
}

describe('StorefrontStatusBadge', () => {
  it('renders known values through the owner-provided maps', () => {
    const { element } = setup('Active');

    expect(badge(element)?.textContent?.trim()).toBe('[test.status.active]');
    expect(badge(element)?.className).toContain('tone-success');
  });

  it('renders unknown values verbatim with the neutral tone', () => {
    const { element } = setup('Chargeback');

    expect(badge(element)?.textContent?.trim()).toBe('Chargeback');
    expect(badge(element)?.className).toContain('tone-neutral');
  });

  it('resolves the unknown entry for blank statuses', () => {
    const { element } = setup('');

    expect(badge(element)?.textContent?.trim()).toBe('Unknown');
    expect(badge(element)?.className).toContain('tone-neutral');
  });
});
