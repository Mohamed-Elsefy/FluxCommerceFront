/**
 * Component tests for the Sub-Phase 10.2 `AccountNav`.
 *
 * Covers presentational behavior only (link rendering from `items`,
 * landmark labelling, active-section styling through the real router):
 * the component holds no state, performs no HTTP, and touches no
 * session — item ownership and logout stay in the account shell.
 *
 * Inputs flow through a host component (the `StorefrontNav` spec
 * pattern) — the realistic binding path for `@Input()` decorators.
 */

import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { AccountNav, type AccountNavItem } from './account-nav';

@Component({ selector: 'account-nav-dummy', template: '' })
class DummyPage {}

@Component({
  selector: 'account-nav-host',
  imports: [AccountNav],
  template: `<account-nav [items]="items" [label]="label" />`,
})
class NavHost {
  items: readonly AccountNavItem[] = [
    { label: 'Profile', route: '/account/profile' },
    { label: 'Orders', route: '/account/orders' },
  ];
  label = 'Account';
}

function setup(configure: (host: NavHost) => void = (): void => undefined): {
  fixture: ComponentFixture<NavHost>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'account/profile', component: DummyPage },
        { path: 'account/orders', component: DummyPage },
      ]),
    ],
  });
  const fixture = TestBed.createComponent(NavHost);
  configure(fixture.componentInstance);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('AccountNav', () => {
  it('renders one link per item with its route', () => {
    const { element } = setup();

    const links = [...element.querySelectorAll('a')];
    expect(links.map((link) => link.textContent?.trim())).toEqual(['Profile', 'Orders']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/account/profile',
      '/account/orders',
    ]);
  });

  it('exposes the landmark name for assistive technology', () => {
    const { element } = setup((host) => {
      host.label = 'Account sections';
    });

    expect(element.querySelector('nav')?.getAttribute('aria-label')).toBe('Account sections');
  });

  it('renders no links without items (never dead entries)', () => {
    const { element } = setup((host) => {
      host.items = [];
    });

    expect(element.querySelectorAll('a')).toHaveLength(0);
  });

  it('marks the active section accessibly after navigation', async () => {
    const { fixture, element } = setup();

    await TestBed.inject(Router).navigateByUrl('/account/orders');
    fixture.detectChanges();

    const links = [...element.querySelectorAll('a')];
    const orders = links.find((link) => link.textContent?.trim() === 'Orders');
    const profile = links.find((link) => link.textContent?.trim() === 'Profile');
    expect(orders?.classList.contains('active')).toBe(true);
    expect(orders?.getAttribute('aria-current')).toBe('page');
    expect(profile?.classList.contains('active')).toBe(false);
  });
});
