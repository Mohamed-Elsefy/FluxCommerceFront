import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { AdminSelect } from './select';

function setup(): { fixture: ComponentFixture<AdminSelect>; element: HTMLElement } {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(AdminSelect);
  fixture.componentRef.setInput('control', new FormControl('a'));
  fixture.componentRef.setInput('options', [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta' },
  ]);
  fixture.componentRef.setInput('label', 'Choice');
  fixture.componentRef.setInput('fieldId', 'choice');
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('AdminSelect', () => {
  it('renders options with label association and writes selection back', () => {
    const { fixture, element } = setup();
    const field = element.querySelector('select.select') as HTMLSelectElement;

    expect(element.querySelector('label')?.getAttribute('for')).toBe('choice');
    expect(
      [...field.querySelectorAll('option')].map((option) => option.textContent?.trim()),
    ).toEqual(['Alpha', 'Beta']);
    expect(field.value).toBe('a');

    field.value = 'b';
    field.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(fixture.componentInstance.control.value).toBe('b');
  });
});
