import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Chip } from './chip';

describe('Chip', () => {
  it('renders unselected by default', () => {
    const fixture = TestBed.createComponent(Chip);
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('button.chip');
    expect(btn?.getAttribute('data-selected')).toBe('false');
    expect(btn?.getAttribute('aria-pressed')).toBe('false');
  });

  it('reflects selected and urgency tone', () => {
    const fixture = TestBed.createComponent(Chip);
    fixture.componentInstance.selected = true;
    fixture.componentInstance.tone = 'urgency';
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('button.chip');
    expect(btn?.getAttribute('data-selected')).toBe('true');
    expect(btn?.getAttribute('data-tone')).toBe('urgency');
  });
});
