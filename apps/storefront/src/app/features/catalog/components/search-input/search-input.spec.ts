/**
 * Component tests for the Sub-Phase 5.5 `SearchInput`.
 *
 * Covers the presentational contract only: label/placeholder/value
 * rendering, raw per-keystroke emission (debouncing stays with the owning
 * page by design), and accessible label association. No timers, no HTTP.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SearchInput } from './search-input';

function setup(input: { value?: string; placeholder?: string | null }): {
  fixture: ComponentFixture<SearchInput>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(SearchInput);
  fixture.componentRef.setInput('value', input.value ?? '');
  fixture.componentRef.setInput('label', 'Search products');
  if (input.placeholder !== undefined) {
    fixture.componentRef.setInput('placeholder', input.placeholder);
  }
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function field(element: HTMLElement): HTMLInputElement {
  const input = element.querySelector('input.search-input');
  if (input === null) {
    throw new Error('Search field did not render');
  }
  return input as HTMLInputElement;
}

describe('SearchInput', () => {
  it('renders the label, value, and placeholder', () => {
    const { element } = setup({ value: 'tee', placeholder: 'Search by keyword…' });
    const input = field(element);

    expect(element.querySelector('.search-label')?.textContent).toBe('Search products');
    expect(input.getAttribute('type')).toBe('search');
    expect(input.value).toBe('tee');
    expect(input.getAttribute('placeholder')).toBe('Search by keyword…');
  });

  it('omits the placeholder attribute when none is provided', () => {
    const { element } = setup({});

    expect(field(element).hasAttribute('placeholder')).toBe(false);
  });

  it('associates the label with the field without id bookkeeping', () => {
    const { element } = setup({});

    expect(element.querySelector('label.search-field input.search-input')).not.toBeNull();
  });

  it('emits raw text on every keystroke (undebounced by design)', () => {
    const { fixture, element } = setup({});
    const emitted: string[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => {
      emitted.push(value);
    });
    const input = field(element);

    input.value = 't';
    input.dispatchEvent(new Event('input'));
    input.value = 'te';
    input.dispatchEvent(new Event('input'));

    expect(emitted).toEqual(['t', 'te']);
  });
});
