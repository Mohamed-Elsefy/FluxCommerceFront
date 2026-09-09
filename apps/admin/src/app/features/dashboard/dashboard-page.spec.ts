import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { DashboardPage } from './dashboard-page';

describe('DashboardPage', () => {
  it('renders the protected entry heading', () => {
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Administration');
  });
});
