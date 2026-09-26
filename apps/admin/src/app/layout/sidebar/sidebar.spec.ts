import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { AdminSidebar, type AdminNavItem } from './sidebar';

@Component({ selector: 'blank-page', template: '' })
class BlankPage {}

const ITEMS: readonly AdminNavItem[] = [
  { label: 'Home', route: '/', icon: '⌂' },
  {
    label: 'Sections',
    children: [
      { label: 'Dashboard', route: '/dashboard', icon: '▦' },
      { label: 'Reports', route: '/reports' },
    ],
  },
];

@Component({
  selector: 'admin-sidebar-host',
  imports: [AdminSidebar],
  template: `<admin-sidebar
    [items]="items"
    [label]="label"
    [brand]="brand"
    [drawerOpen]="drawerOpen"
    (navigated)="onNavigated()"
  />`,
})
class SidebarHost {
  items: readonly AdminNavItem[] = ITEMS;
  label = 'Admin';
  brand = 'FluxCommerce Admin';
  drawerOpen = false;
  navigatedCount = 0;

  onNavigated(): void {
    this.navigatedCount += 1;
  }
}

function setup(
  configure: (host: SidebarHost) => void = (): void => undefined,
  routes: { path: string }[] = [],
): { fixture: ComponentFixture<SidebarHost>; element: HTMLElement } {
  TestBed.configureTestingModule({
    providers: [provideRouter(routes.map((route) => ({ ...route, component: BlankPage })))],
  });
  const fixture = TestBed.createComponent(SidebarHost);
  configure(fixture.componentInstance);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function linkLabels(element: HTMLElement): (string | null | undefined)[] {
  return [...element.querySelectorAll('.sidebar a .item-label')].map((node) =>
    node.textContent?.trim(),
  );
}

describe('AdminSidebar', () => {
  it('renders one link per routed item with a closed drawer by default', () => {
    const { element } = setup();

    expect(linkLabels(element)).toEqual(['Home', 'Dashboard', 'Reports']);
    expect(element.querySelector('.sidebar')?.getAttribute('aria-label')).toBe('Admin');
    expect(element.querySelector('.sidebar .brand')?.textContent).toBe('FluxCommerce Admin');
    expect(element.querySelector('admin-sidebar')?.getAttribute('data-drawer')).toBe('closed');
  });

  it('renders group labels for nested sections without a route', () => {
    const { element } = setup();

    expect(element.querySelector('.sidebar .group')?.textContent).toBe('Sections');
    expect(element.querySelectorAll('.sidebar ul.nested a')).toHaveLength(2);
  });

  it('renders decorative icons without stealing the accessible name', () => {
    const { element } = setup();

    const glyphs = [...element.querySelectorAll('.sidebar a flux-icon .icon')];
    expect(glyphs).toHaveLength(2);
    expect(glyphs.every((icon) => icon.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(glyphs.map((icon) => icon.textContent?.trim())).toEqual(['⌂', '▦']);
  });

  it('localizes the landmark and brand through inputs', () => {
    const { element } = setup((host) => {
      host.label = 'الإدارة';
      host.brand = 'إدارة FluxCommerce';
    });

    expect(element.querySelector('.sidebar')?.getAttribute('aria-label')).toBe('الإدارة');
    expect(element.querySelector('.sidebar .brand')?.textContent).toBe('إدارة FluxCommerce');
  });

  it('reflects the drawer state through inputs only', () => {
    const { element } = setup((host) => {
      host.drawerOpen = true;
    });

    expect(element.querySelector('admin-sidebar')?.getAttribute('data-drawer')).toBe('open');
  });

  it('notifies the parent when a destination is activated', () => {
    const { fixture } = setup(undefined, [{ path: '' }]);
    const before = fixture.componentInstance.navigatedCount;

    (fixture.nativeElement as HTMLElement)
      .querySelector('.sidebar a')
      ?.dispatchEvent(new Event('click', { bubbles: true }));

    expect(fixture.componentInstance.navigatedCount).toBe(before + 1);
  });

  it('marks only the active route with styling and aria-current', async () => {
    const { fixture, element } = setup(undefined, [{ path: '' }, { path: 'dashboard' }]);

    await TestBed.inject(Router).navigateByUrl('/dashboard');
    fixture.detectChanges();

    const links = [...element.querySelectorAll('.sidebar a')];
    const active = links.filter((anchor) => anchor.classList.contains('active'));
    expect(
      active.map((anchor) => anchor.querySelector('.item-label')?.textContent?.trim()),
    ).toEqual(['Dashboard']);
    expect(active[0].getAttribute('aria-current')).toBe('page');
  });
});
