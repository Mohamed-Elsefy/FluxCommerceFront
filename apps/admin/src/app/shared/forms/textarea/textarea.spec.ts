import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { AdminTextarea } from './textarea';

function setup(): { fixture: ComponentFixture<AdminTextarea>; element: HTMLElement } {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(AdminTextarea);
  fixture.componentRef.setInput('control', new FormControl(''));
  fixture.componentRef.setInput('label', 'Description');
  fixture.componentRef.setInput('fieldId', 'description');
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('AdminTextarea', () => {
  it('binds the control with label association and keyboard input', () => {
    const { fixture, element } = setup();
    const area = element.querySelector('textarea.textarea') as HTMLTextAreaElement;

    expect(element.querySelector('label')?.getAttribute('for')).toBe('description');
    expect(area.getAttribute('rows')).toBe('4');

    area.value = 'Long text';
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.control.value).toBe('Long text');
  });
});
