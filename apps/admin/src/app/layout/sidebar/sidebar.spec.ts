import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { AdminSidebar, type AdminNavItem } from './sidebar';

@Component({ selector: 'blank-page', template: '' })
class BlankPage {}

const ITEMS: readonly AdminNavItem[] = [
  { label: 'Home', route: '/' },
  { label: 'Dashboard', route: '/dashboard' },
];

@Component({
  selector: 'admin-sidebar-host',
  imports: [AdminSidebar],
  template: `<admin-sidebar
    [items]="items"
    [drawerOpen]="drawerOpen"
    (navigated)="onNavigated()"
  />`,
})
class SidebarHost {
  items: readonly AdminNavItem[] = ITEMS;
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

describe('AdminSidebar', () => {
  it('renders one link per item with a closed drawer by default', () => {
    const { element } = setup();

    const links = [...element.querySelectorAll('.sidebar a')].map((anchor) =>
      anchor.textContent?.trim(),
    );
    expect(links).toEqual(['Home', 'Dashboard']);
    expect(element.querySelector('.sidebar')?.getAttribute('aria-label')).toBe('Admin');
    expect(element.querySelector('admin-sidebar')?.getAttribute('data-drawer')).toBe('closed');
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
    expect(active.map((anchor) => anchor.textContent?.trim())).toEqual(['Dashboard']);
    expect(active[0].getAttribute('aria-current')).toBe('page');
  });
});
