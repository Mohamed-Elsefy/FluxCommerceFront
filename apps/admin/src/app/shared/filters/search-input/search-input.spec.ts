import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { AdminSearchInput } from './search-input';

function setup(): { fixture: ComponentFixture<AdminSearchInput>; element: HTMLElement } {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(AdminSearchInput);
  fixture.componentRef.setInput('control', new FormControl(''));
  fixture.componentRef.setInput('label', 'Search');
  fixture.componentRef.setInput('fieldId', 'search');
  fixture.componentRef.setInput('clearLabel', 'Clear');
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('AdminSearchInput', () => {
  it('streams keystrokes through the bound control', () => {
    const { fixture, element } = setup();
    const field = element.querySelector('input.search-input-field') as HTMLInputElement;

    expect(field.getAttribute('type')).toBe('search');
    expect(element.querySelector('label')?.getAttribute('for')).toBe('search');

    field.value = 'sku';
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.control.value).toBe('sku');
    expect(element.querySelector('.search-input-clear')?.textContent?.trim()).toBe('Clear');
  });

  it('clears the query through the clear action', () => {
    const { fixture, element } = setup();
    fixture.componentInstance.control.setValue('sku');
    fixture.detectChanges();

    (element.querySelector('.search-input-clear') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.control.value).toBe('');
    expect(element.querySelector('.search-input-clear')).toBeNull();
  });
});
