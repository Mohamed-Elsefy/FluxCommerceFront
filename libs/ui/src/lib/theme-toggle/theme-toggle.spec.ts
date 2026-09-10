import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, expect, it } from 'vitest';
import { ThemeToggle } from './theme-toggle';

function setup(configure: (instance: ThemeToggle) => void = (): void => undefined): {
  instance: ThemeToggle;
  element: HTMLElement;
} {
  const fixture = TestBed.createComponent(ThemeToggle);
  configure(fixture.componentInstance);
  fixture.detectChanges();
  return { instance: fixture.componentInstance, element: fixture.nativeElement as HTMLElement };
}

describe('ThemeToggle', () => {
  it('renders the switch-to-dark affordance in light mode', () => {
    const { element } = setup();

    const button = element.querySelector('button.toggle');
    expect(button?.getAttribute('aria-label')).toBe('Switch to dark theme');
    expect(button?.textContent).toContain('☾');
  });

  it('renders the switch-to-light affordance in dark mode', () => {
    const { element } = setup((instance) => {
      instance.mode = 'dark';
    });

    const button = element.querySelector('button.toggle');
    expect(button?.getAttribute('aria-label')).toBe('Switch to light theme');
    expect(button?.textContent).toContain('☀');
  });

  it('emits toggled without owning state', () => {
    const fixture = TestBed.createComponent(ThemeToggle);
    fixture.detectChanges();
    let emitted = 0;
    fixture.componentInstance.toggled.subscribe(() => (emitted += 1));

    fixture.debugElement.query(By.css('button.toggle')).triggerEventHandler('click', null);

    expect(emitted).toBe(1);
    expect(fixture.componentInstance.mode).toBe('light');
  });
});
