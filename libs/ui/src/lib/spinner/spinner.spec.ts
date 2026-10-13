import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Spinner } from './spinner';

function setup(configure: (instance: Spinner) => void = (): void => undefined): HTMLElement {
  const fixture = TestBed.createComponent(Spinner);
  configure(fixture.componentInstance);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('Spinner', () => {
  it('announces progress with a default label and size', () => {
    const element = setup();

    const ring = element.querySelector('.spinner');
    expect(ring).not.toBeNull();
    expect(ring?.getAttribute('role')).toBe('status');
    expect(ring?.getAttribute('aria-label')).toBe('Loading');
    expect(ring?.getAttribute('data-size')).toBe('md');
  });

  it('reflects localized labels and sizes through inputs only', () => {
    const element = setup((instance) => {
      instance.label = 'Chargement';
      instance.size = 'lg';
    });

    const ring = element.querySelector('.spinner');
    expect(ring?.getAttribute('aria-label')).toBe('Chargement');
    expect(ring?.getAttribute('data-size')).toBe('lg');
  });

  it('renders decoratively (hidden, no role) when the label is null', () => {
    const element = setup((instance) => {
      instance.label = null;
    });

    const ring = element.querySelector('.spinner');
    expect(ring?.getAttribute('role')).toBeNull();
    expect(ring?.getAttribute('aria-label')).toBeNull();
    expect(ring?.getAttribute('aria-hidden')).toBe('true');
  });
});
