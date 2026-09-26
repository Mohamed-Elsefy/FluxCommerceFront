import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { AdminFilterBar } from './filter-bar';

@Component({
  selector: 'admin-filter-bar-host',
  imports: [AdminFilterBar],
  template: `<admin-filter-bar label="Order filters" clearLabel="Clear all" (clear)="onClear()">
    <input class="probe" />
  </admin-filter-bar>`,
})
class FilterBarHost {
  readonly onClear = vi.fn();
}

function setup(): { fixture: ComponentFixture<FilterBarHost>; element: HTMLElement } {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(FilterBarHost);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('AdminFilterBar', () => {
  it('projects controls with an accessible landmark and clear action', () => {
    const { fixture, element } = setup();

    expect(element.querySelector('section.filter-bar')?.getAttribute('aria-label')).toBe(
      'Order filters',
    );
    expect(element.querySelector('.filter-bar-controls .probe')).not.toBeNull();

    (element.querySelector('.filter-bar-clear') as HTMLButtonElement).click();

    expect(fixture.componentInstance.onClear).toHaveBeenCalledTimes(1);
  });
});
