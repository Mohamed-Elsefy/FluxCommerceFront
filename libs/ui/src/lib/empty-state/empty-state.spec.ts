import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './empty-state';

function textOf(element: HTMLElement, selector: string): string | null {
  return element.querySelector(selector)?.textContent?.trim() ?? null;
}

describe('EmptyState', () => {
  it('renders title, message, and icon from inputs', () => {
    const fixture = TestBed.createComponent(EmptyState);
    fixture.componentInstance.title = 'No products found';
    fixture.componentInstance.message = 'Try a different search term.';
    fixture.componentInstance.icon = '*';
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(textOf(element, '.title')).toBe('No products found');
    expect(textOf(element, '.message')).toBe('Try a different search term.');
    expect(textOf(element, '.icon')).toBe('*');
  });

  it('omits optional parts when unset', () => {
    const fixture = TestBed.createComponent(EmptyState);
    fixture.componentInstance.title = 'Nothing here';
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(textOf(element, '.title')).toBe('Nothing here');
    expect(element.querySelector('.message')).toBeNull();
    expect(element.querySelector('.icon')).toBeNull();
  });
});
