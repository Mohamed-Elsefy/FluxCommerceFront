import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { AdminDateRange } from './date-range';

function setup(): { fixture: ComponentFixture<AdminDateRange>; element: HTMLElement } {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(AdminDateRange);
  fixture.componentRef.setInput('from', new FormControl<string | null>(null));
  fixture.componentRef.setInput('to', new FormControl<string | null>(null));
  fixture.componentRef.setInput('fromLabel', 'From');
  fixture.componentRef.setInput('toLabel', 'To');
  fixture.componentRef.setInput('fromId', 'from');
  fixture.componentRef.setInput('toId', 'to');
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('AdminDateRange', () => {
  it('binds both bounds with label association', () => {
    const { fixture, element } = setup();
    const fields = [...element.querySelectorAll('input.date-range-field')] as HTMLInputElement[];

    expect(fields).toHaveLength(2);
    expect(fields.every((field) => field.getAttribute('type') === 'date')).toBe(true);
    expect(element.querySelector('label[for="from"]')?.textContent).toBe('From');
    expect(element.querySelector('label[for="to"]')?.textContent).toBe('To');

    fields[0].value = '2026-01-01';
    fields[0].dispatchEvent(new Event('input'));
    fields[1].value = '2026-01-31';
    fields[1].dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.from.value).toBe('2026-01-01');
    expect(fixture.componentInstance.to.value).toBe('2026-01-31');
  });
});
