import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { RetryButton } from './retry-button';

function setup(): { button: HTMLButtonElement | null; pressed: () => number } {
  const fixture = TestBed.createComponent(RetryButton);
  fixture.detectChanges();

  let pressed = 0;
  fixture.componentInstance.pressed.subscribe(() => (pressed += 1));
  return {
    button: (fixture.nativeElement as HTMLElement).querySelector('button'),
    pressed: () => pressed,
  };
}

describe('RetryButton', () => {
  it('renders the default label and emits pressed on click', () => {
    const { button, pressed } = setup();

    expect(button?.textContent?.trim()).toBe('Retry');
    button?.click();
    expect(pressed()).toBe(1);
  });

  it('reflects label, size, and disabled state through inputs only', () => {
    const fixture = TestBed.createComponent(RetryButton);
    fixture.componentInstance.label = 'Try again';
    fixture.componentInstance.size = 'sm';
    fixture.componentInstance.disabled = true;
    fixture.detectChanges();

    let pressed = 0;
    fixture.componentInstance.pressed.subscribe(() => (pressed += 1));
    const button = (fixture.nativeElement as HTMLElement).querySelector('button');
    expect(button?.textContent?.trim()).toBe('Try again');
    expect(button?.getAttribute('data-size')).toBe('sm');
    expect(button?.disabled).toBe(true);

    button?.click();
    expect(pressed).toBe(0);
  });
});
