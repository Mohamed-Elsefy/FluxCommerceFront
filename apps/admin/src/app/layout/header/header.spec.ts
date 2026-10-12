import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { provideApi, provideAppEnvironment } from '@flux/api';
import { provideAuthRecovery } from '@flux/auth';
import { CultureService } from '@flux/i18n';
import { ThemeService } from '@flux/theming';
import { AdminHeader } from './header';

@Component({
  selector: 'admin-header-host',
  imports: [AdminHeader],
  template: `<admin-header [drawerOpen]="open" />`,
})
class HeaderHost {
  open = false;
}

function setup(): { fixture: ComponentFixture<AdminHeader>; element: HTMLElement } {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideAppEnvironment({
        name: 'development',
        production: false,
        appName: 'test',
        apiBaseUrl: '/api',
      }),
      provideApi(),
      provideAuthRecovery(),
      provideHttpClientTesting(),
    ],
  });
  window.localStorage.clear();
  const fixture = TestBed.createComponent(AdminHeader);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('AdminHeader', () => {
  it('renders the language pill and the admin user area without a context title', () => {
    const { element } = setup();

    expect(element.querySelector('.context')).toBeNull();
    expect(element.querySelector('.lang-button')?.textContent).toContain('English');
    expect(element.querySelector('auth-nav')).not.toBeNull();
  });

  it('renders no account entry in the operator area', () => {
    const { element } = setup();

    expect(element.querySelector('auth-nav a')).toBeNull();
  });

  it('routes post-logout navigation to the admin login', () => {
    const { fixture } = setup();
    const authNav = fixture.debugElement.query(
      (node) => String(node.nativeElement?.tagName ?? '').toLowerCase() === 'auth-nav',
    );

    expect(authNav?.componentInstance?.logoutRedirectTo).toBe('/login');
  });

  it('emits menuToggle when the drawer toggle is activated', () => {
    const { fixture, element } = setup();
    let emitted = 0;
    fixture.componentInstance.menuToggle.subscribe(() => (emitted += 1));

    (element.querySelector('button.menu-toggle') as HTMLButtonElement).click();

    expect(emitted).toBe(1);
  });

  it('reflects the drawer state for assistive technology', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideAppEnvironment({
          name: 'development',
          production: false,
          appName: 'test',
          apiBaseUrl: '/api',
        }),
        provideApi(),
        provideAuthRecovery(),
        provideHttpClientTesting(),
      ],
    });
    window.localStorage.clear();
    const fixture = TestBed.createComponent(HeaderHost);
    fixture.componentInstance.open = true;
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    const toggle = element.querySelector('button.menu-toggle');
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(toggle?.getAttribute('aria-controls')).toBe('admin-drawer');
  });

  it('wires the shared theme toggle to the central theme state', () => {
    const { fixture, element } = setup();
    const themes = TestBed.inject(ThemeService);

    expect(themes.theme()).toBe('dark');

    (element.querySelector('flux-theme-toggle button.toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(themes.theme()).toBe('light');
    expect(
      element.querySelector('flux-theme-toggle button.toggle')?.getAttribute('aria-label'),
    ).toBe('Switch to dark theme');
  });

  it('steps to the next culture on each pill press, wrapping around', () => {
    const { fixture, element } = setup();
    const cultures = TestBed.inject(CultureService);
    const pill = element.querySelector('.lang-button') as HTMLButtonElement;

    pill.click();
    fixture.detectChanges();
    expect(cultures.culture()).toBe('fr');
    expect(pill.textContent).toContain('Français');

    pill.click();
    pill.click();
    pill.click();
    fixture.detectChanges();
    expect(cultures.culture()).toBe('ar');
    expect(pill.textContent).toContain('العربية');

    pill.click();
    fixture.detectChanges();
    expect(cultures.culture()).toBe('en');
  });

  it('localizes header chrome for the active culture', () => {
    const { fixture, element } = setup();
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('fr');
    try {
      fixture.detectChanges();

      expect(element.querySelector('button.menu-toggle')?.getAttribute('aria-label')).toBe(
        'Basculer la navigation',
      );
      expect(element.querySelector('.lang-button')?.textContent).toContain('Français');
    } finally {
      cultures.setCulture('en');
    }
  });
});
