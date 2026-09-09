import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Button } from './button';

function setup(configure: (instance: Button) => void = (): void => undefined): HTMLElement {
  const fixture = TestBed.createComponent(Button);
  configure(fixture.componentInstance);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function innerButton(element: HTMLElement): HTMLButtonElement | null {
  return element.querySelector('button.button');
}

describe('Button', () => {
  it('renders a native button with default variant, size, and type', () => {
    const element = setup();

    const button = innerButton(element);
    expect(button).not.toBeNull();
    expect(button?.getAttribute('data-variant')).toBe('primary');
    expect(button?.getAttribute('data-size')).toBe('md');
    expect(button?.getAttribute('type')).toBe('button');
    expect(button?.disabled).toBe(false);
  });

  it('reflects variant, size, and type through inputs only', () => {
    const element = setup((instance) => {
      instance.variant = 'ghost';
      instance.size = 'lg';
      instance.type = 'submit';
    });

    const button = innerButton(element);
    expect(button?.getAttribute('data-variant')).toBe('ghost');
    expect(button?.getAttribute('data-size')).toBe('lg');
    expect(button?.getAttribute('type')).toBe('submit');
  });

  it('disables the control when disabled', () => {
    const element = setup((instance) => {
      instance.disabled = true;
    });

    expect(innerButton(element)?.disabled).toBe(true);
  });

  it('shows a decorative spinner and marks busy while loading', () => {
    const element = setup((instance) => {
      instance.loading = true;
    });

    const button = innerButton(element);
    expect(button?.disabled).toBe(true);
    expect(button?.getAttribute('aria-busy')).toBe('true');
    const spinner = element.querySelector('flux-spinner .spinner');
    expect(spinner).not.toBeNull();
    expect(spinner?.getAttribute('aria-hidden')).toBe('true');
  });

  it('emits native clicks for feature handlers', () => {
    const fixture = TestBed.createComponent(Button);
    fixture.detectChanges();
    let clicked = 0;
    fixture.nativeElement
      .querySelector('button.button')
      .addEventListener('click', () => (clicked += 1));
    fixture.nativeElement.querySelector('button.button').click();

    expect(clicked).toBe(1);
  });
});
