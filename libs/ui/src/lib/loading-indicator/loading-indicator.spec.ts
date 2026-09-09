import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LoadingIndicator } from './loading-indicator';

function setup(): HTMLElement {
  const fixture = TestBed.createComponent(LoadingIndicator);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function textOf(element: HTMLElement, selector: string): string | null {
  return element.querySelector(selector)?.textContent?.trim() ?? null;
}

describe('LoadingIndicator', () => {
  it('announces loading with a default label and spinner', () => {
    const element = setup();

    expect(element.querySelector('[role="status"]')).not.toBeNull();
    expect(element.querySelector('.spinner')).not.toBeNull();
    expect(textOf(element, '.label')).toBe('Loading');
    expect(element.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe('Loading');
  });

  it('reflects localized labels and sizes through inputs only', () => {
    const fixture = TestBed.createComponent(LoadingIndicator);
    fixture.componentInstance.label = 'Chargement';
    fixture.componentInstance.size = 'lg';
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(textOf(element, '.label')).toBe('Chargement');
    expect(element.querySelector('.loading')?.getAttribute('data-size')).toBe('lg');
  });
});
