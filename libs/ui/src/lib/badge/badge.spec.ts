import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Badge } from './badge';

@Component({
  selector: 'flux-badge-host',
  imports: [Badge],
  template: `<flux-badge [variant]="variant">3 new</flux-badge>`,
})
class BadgeHost {
  variant: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' = 'neutral';
}

function setup(variant: BadgeHost['variant'] = 'neutral'): HTMLElement {
  const fixture = TestBed.createComponent(BadgeHost);
  fixture.componentInstance.variant = variant;
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('Badge', () => {
  it('renders projected content with the neutral variant by default', () => {
    const element = setup();

    const badge = element.querySelector('.badge');
    expect(badge?.textContent).toBe('3 new');
    expect(badge?.getAttribute('data-variant')).toBe('neutral');
  });

  it('reflects status variants through inputs only', () => {
    for (const variant of ['primary', 'success', 'warning', 'danger', 'info'] as const) {
      const element = setup(variant);

      expect(element.querySelector('.badge')?.getAttribute('data-variant')).toBe(variant);
    }
  });
});
