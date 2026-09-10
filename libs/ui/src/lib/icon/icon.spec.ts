import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Icon } from './icon';

@Component({
  selector: 'flux-icon-host',
  imports: [Icon],
  template: `<flux-icon [glyph]="glyph" [size]="size"><svg class="mark"></svg></flux-icon>`,
})
class IconHost {
  glyph: string | null = '★';
  size: 'sm' | 'md' | 'lg' = 'md';
}

function setup(): { host: IconHost; element: HTMLElement } {
  const fixture = TestBed.createComponent(IconHost);
  fixture.detectChanges();
  return { host: fixture.componentInstance, element: fixture.nativeElement as HTMLElement };
}

describe('Icon', () => {
  it('renders the glyph decoratively at the default size', () => {
    const { element } = setup();

    const icon = element.querySelector('.icon');
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(icon?.getAttribute('data-size')).toBe('md');
    expect(icon?.textContent).toContain('★');
  });

  it('projects SVG content alongside the glyph', () => {
    const { element } = setup();

    expect(element.querySelector('.icon svg.mark')).not.toBeNull();
  });

  it('reflects sizes through inputs only', () => {
    const fixture = TestBed.createComponent(IconHost);
    fixture.componentInstance.size = 'sm';
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.icon')?.getAttribute('data-size'),
    ).toBe('sm');
  });
});
