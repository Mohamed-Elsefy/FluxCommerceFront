import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { AdminCheckbox } from './checkbox';

function setup(): { fixture: ComponentFixture<AdminCheckbox>; element: HTMLElement } {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(AdminCheckbox);
  fixture.componentRef.setInput('control', new FormControl(false));
  fixture.componentRef.setInput('label', 'Active');
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('AdminCheckbox', () => {
  it('toggles the bound control through keyboard interaction', () => {
    const { fixture, element } = setup();
    const box = element.querySelector('input.checkbox') as HTMLInputElement;

    expect(element.querySelector('.checkbox-label')?.textContent?.trim()).toBe('Active');
    expect(box.checked).toBe(false);

    box.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.control.value).toBe(true);
  });

  it('reflects the disabled state', () => {
    const { fixture, element } = setup();
    fixture.componentInstance.control.disable();
    fixture.detectChanges();

    expect((element.querySelector('input.checkbox') as HTMLInputElement).disabled).toBe(true);
  });
});
