import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Stack } from './stack';
import type { FlexAlign, FlexJustify, LayoutGap } from '../ui-primitives';

@Component({
  selector: 'flux-stack-host',
  imports: [Stack],
  template: `<flux-stack [direction]="direction" [gap]="gap" [align]="align" [justify]="justify">
    <span class="child">one</span><span class="child">two</span>
  </flux-stack>`,
})
class StackHost {
  direction: 'vertical' | 'horizontal' = 'vertical';
  gap: LayoutGap = 'md';
  align: FlexAlign = 'stretch';
  justify: FlexJustify = 'start';
}

function setup(configure: (host: StackHost) => void = (): void => undefined): HTMLElement {
  const fixture = TestBed.createComponent(StackHost);
  configure(fixture.componentInstance);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('Stack', () => {
  it('renders children with vertical flow and default spacing', () => {
    const element = setup();

    const stack = element.querySelector('.stack');
    expect(stack?.querySelectorAll('.child').length).toBe(2);
    expect(stack?.getAttribute('data-direction')).toBe('vertical');
    expect(stack?.getAttribute('data-gap')).toBe('md');
    expect(stack?.getAttribute('data-align')).toBe('stretch');
    expect(stack?.getAttribute('data-justify')).toBe('start');
  });

  it('reflects direction, gap, alignment, and distribution through inputs only', () => {
    const element = setup((host) => {
      host.direction = 'horizontal';
      host.gap = 'lg';
      host.align = 'center';
      host.justify = 'between';
    });

    const stack = element.querySelector('.stack');
    expect(stack?.getAttribute('data-direction')).toBe('horizontal');
    expect(stack?.getAttribute('data-gap')).toBe('lg');
    expect(stack?.getAttribute('data-align')).toBe('center');
    expect(stack?.getAttribute('data-justify')).toBe('between');
  });
});
