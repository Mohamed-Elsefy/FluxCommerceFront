/**
 * Component tests for the Sub-Phase 5.6 `FilterSelect`.
 *
 * Covers the presentational contract only: label/options/value rendering
 * and committed-change emission. The component never interprets tokens —
 * mapping stays with the owning page (and `catalog-query-state`).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { FilterSelect, type FilterOption } from './filter-select';

const OPTIONS: readonly FilterOption[] = [
  { value: '', label: 'All' },
  { value: '0', label: 'Draft' },
  { value: '1', label: 'Active' },
];

function setup(input: { value?: string }): {
  fixture: ComponentFixture<FilterSelect>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(FilterSelect);
  fixture.componentRef.setInput('label', 'Status');
  fixture.componentRef.setInput('options', OPTIONS);
  fixture.componentRef.setInput('value', input.value ?? '');
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function field(element: HTMLElement): HTMLSelectElement {
  const select = element.querySelector('select.filter-input');
  if (select === null) {
    throw new Error('Filter field did not render');
  }
  return select as HTMLSelectElement;
}

describe('FilterSelect', () => {
  it('renders the label with every option in order', () => {
    const { element } = setup({ value: '1' });

    expect(element.querySelector('.filter-label')?.textContent).toBe('Status');
    expect(
      [...field(element).querySelectorAll('option')].map((option) => option.textContent),
    ).toEqual(['All', 'Draft', 'Active']);
    expect(field(element).value).toBe('1');
  });

  it('associates the label with the field without id bookkeeping', () => {
    const { element } = setup({});

    expect(element.querySelector('label.filter-field select.filter-input')).not.toBeNull();
  });

  it('emits the selected token on change', () => {
    const { fixture, element } = setup({});
    const emitted: string[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => {
      emitted.push(value);
    });
    const select = field(element);

    select.value = '1';
    select.dispatchEvent(new Event('change'));

    expect(emitted).toEqual(['1']);
  });
});
