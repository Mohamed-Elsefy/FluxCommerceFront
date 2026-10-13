import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Grid } from './grid';
import type { LayoutGap } from '../ui-primitives';

@Component({
  selector: 'flux-grid-host',
  imports: [Grid],
  template: `<flux-grid [columns]="columns" [gap]="gap">
    <span class="cell">one</span><span class="cell">two</span>
  </flux-grid>`,
})
class GridHost {
  columns = 1;
  gap: LayoutGap = 'md';
}

function setup(configure: (host: GridHost) => void = (): void => undefined): HTMLElement {
  const fixture = TestBed.createComponent(GridHost);
  configure(fixture.componentInstance);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('Grid', () => {
  it('renders cells in a single column with the default gap', () => {
    const element = setup();

    const grid = element.querySelector('.grid');
    expect(grid?.querySelectorAll('.cell').length).toBe(2);
    expect(grid?.getAttribute('data-gap')).toBe('md');
    expect((grid as HTMLElement | null)?.style.gridTemplateColumns).toBe(
      'repeat(1, minmax(0, 1fr))',
    );
  });

  it('reflects column counts and gaps through inputs only', () => {
    const element = setup((host) => {
      host.columns = 3;
      host.gap = 'lg';
    });

    const grid = element.querySelector('.grid');
    expect((grid as HTMLElement | null)?.style.gridTemplateColumns).toBe(
      'repeat(3, minmax(0, 1fr))',
    );
    expect(grid?.getAttribute('data-gap')).toBe('lg');
  });

  it('clamps invalid column counts to a single column', () => {
    const element = setup((host) => {
      host.columns = 0;
    });

    expect((element.querySelector('.grid') as HTMLElement | null)?.style.gridTemplateColumns).toBe(
      'repeat(1, minmax(0, 1fr))',
    );
  });
});
