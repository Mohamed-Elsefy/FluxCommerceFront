import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { DashboardCard } from './dashboard-card';

function setup(): { fixture: ComponentFixture<DashboardCard>; element: HTMLElement } {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(DashboardCard);
  fixture.componentRef.setInput('title', 'Catalog');
  fixture.componentRef.setInput('description', 'Products and categories.');
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('DashboardCard', () => {
  it('renders the title and description inside the shared card surface', () => {
    const { element } = setup();

    expect(element.querySelector('flux-card')).not.toBeNull();
    expect(element.querySelector('.dashboard-card-title')?.textContent).toBe('Catalog');
    expect(element.querySelector('.dashboard-card-description')?.textContent).toBe(
      'Products and categories.',
    );
    expect(element.querySelector('flux-badge')).toBeNull();
  });

  it('renders the status badge only when provided', () => {
    const { fixture, element } = setup();
    fixture.componentRef.setInput('badge', 'Upcoming');
    fixture.componentRef.setInput('badgeVariant', 'info');
    fixture.detectChanges();

    expect(element.querySelector('flux-badge')?.textContent?.trim()).toBe('Upcoming');
  });
});
