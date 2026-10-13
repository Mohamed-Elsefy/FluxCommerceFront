import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { StorefrontNav, type StorefrontNavItem } from './navigation';

@Component({ selector: 'blank-page', template: '' })
class BlankPage {}

const ITEMS: readonly StorefrontNavItem[] = [
  { label: 'Home', route: '/' },
  { label: 'Second', route: '/second' },
];

@Component({
  selector: 'storefront-nav-host',
  imports: [StorefrontNav],
  template: `<storefront-nav [items]="items" [orientation]="orientation" label="Main" />`,
})
class NavHost {
  items: readonly StorefrontNavItem[] = ITEMS;
  orientation: 'horizontal' | 'vertical' = 'horizontal';
}

function setup(
  configure: (host: NavHost) => void = (): void => undefined,
  routes: { path: string }[] = [],
): { fixture: ComponentFixture<NavHost>; element: HTMLElement } {
  TestBed.configureTestingModule({
    providers: [provideRouter(routes.map((route) => ({ ...route, component: BlankPage })))],
  });
  const fixture = TestBed.createComponent(NavHost);
  configure(fixture.componentInstance);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('StorefrontNav', () => {
  it('renders one link per item with a horizontal flow by default', () => {
    const { element } = setup();

    const links = [...element.querySelectorAll('.nav a')].map((anchor) =>
      anchor.textContent?.trim(),
    );
    expect(links).toEqual(['Home', 'Second']);
    expect(element.querySelector('.nav')?.getAttribute('data-orientation')).toBe('horizontal');
    expect(element.querySelector('.nav')?.getAttribute('aria-label')).toBe('Main');
  });

  it('renders a vertical flow when oriented vertically', () => {
    const { element } = setup((host) => {
      host.orientation = 'vertical';
    });

    expect(element.querySelector('.nav')?.getAttribute('data-orientation')).toBe('vertical');
  });

  it('marks only the active route with styling and aria-current', async () => {
    const { fixture } = setup(undefined, [{ path: '' }, { path: 'second' }]);

    await TestBed.inject(Router).navigateByUrl('/second');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const links = [...element.querySelectorAll('.nav a')];
    const active = links.filter((anchor) => anchor.classList.contains('active'));
    expect(active.map((anchor) => anchor.textContent?.trim())).toEqual(['Second']);
    expect(active[0].getAttribute('aria-current')).toBe('page');
  });
});
