import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Divider } from './divider';

function setup(configure: (instance: Divider) => void = (): void => undefined): HTMLElement {
  const fixture = TestBed.createComponent(Divider);
  configure(fixture.componentInstance);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('Divider', () => {
  it('renders a horizontal rule by default', () => {
    const element = setup();

    expect(element.querySelector('hr.divider')).not.toBeNull();
    expect(element.querySelector('[role="separator"]')).toBeNull();
  });

  it('renders a vertical separator with orientation metadata', () => {
    const element = setup((instance) => {
      instance.orientation = 'vertical';
    });

    expect(element.querySelector('hr')).toBeNull();
    const separator = element.querySelector('.divider--vertical');
    expect(separator?.getAttribute('role')).toBe('separator');
    expect(separator?.getAttribute('aria-orientation')).toBe('vertical');
  });
});
