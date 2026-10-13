import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Flex } from './flex';
import type { FlexAlign, FlexJustify, LayoutGap } from '../ui-primitives';

@Component({
  selector: 'flux-flex-host',
  imports: [Flex],
  template: `<flux-flex
    [direction]="direction"
    [gap]="gap"
    [align]="align"
    [justify]="justify"
    [wrap]="wrap"
  >
    <span class="item">one</span><span class="item">two</span>
  </flux-flex>`,
})
class FlexHost {
  direction: 'row' | 'column' = 'row';
  gap: LayoutGap = 'md';
  align: FlexAlign = 'stretch';
  justify: FlexJustify = 'start';
  wrap = false;
}

function setup(configure: (host: FlexHost) => void = (): void => undefined): HTMLElement {
  const fixture = TestBed.createComponent(FlexHost);
  configure(fixture.componentInstance);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('Flex', () => {
  it('renders items with row flow and defaults, unwrapped', () => {
    const element = setup();

    const flex = element.querySelector('.flex');
    expect(flex?.querySelectorAll('.item').length).toBe(2);
    expect(flex?.getAttribute('data-direction')).toBe('row');
    expect(flex?.getAttribute('data-gap')).toBe('md');
    expect(flex?.getAttribute('data-wrap')).toBe('false');
  });

  it('reflects direction, gap, alignment, distribution, and wrap through inputs only', () => {
    const element = setup((host) => {
      host.direction = 'column';
      host.gap = 'sm';
      host.align = 'center';
      host.justify = 'evenly';
      host.wrap = true;
    });

    const flex = element.querySelector('.flex');
    expect(flex?.getAttribute('data-direction')).toBe('column');
    expect(flex?.getAttribute('data-gap')).toBe('sm');
    expect(flex?.getAttribute('data-align')).toBe('center');
    expect(flex?.getAttribute('data-justify')).toBe('evenly');
    expect(flex?.getAttribute('data-wrap')).toBe('true');
  });
});
