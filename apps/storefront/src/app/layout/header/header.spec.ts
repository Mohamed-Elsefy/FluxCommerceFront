import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { provideApi, provideAppEnvironment } from '@flux/api';
import { provideAuthRecovery } from '@flux/auth';
import { ThemeService } from '@flux/theming';
import { StorefrontHeader } from './header';

function setup(): { fixture: ComponentFixture<StorefrontHeader>; element: HTMLElement } {
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
  const fixture = TestBed.createComponent(StorefrontHeader);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('StorefrontHeader', () => {
  it('renders the brand, desktop navigation, and auth entry points', () => {
    const { element } = setup();

    expect(element.querySelector('.brand')?.getAttribute('href')).toBe('/');
    expect(element.querySelector('.desktop-nav .nav a')?.textContent?.trim()).toBe('Home');
    expect(element.querySelector('auth-nav')).not.toBeNull();
  });

  it('toggles the mobile navigation panel with accessible state', () => {
    const { fixture, element } = setup();
    const toggle = element.querySelector('button.menu-toggle') as HTMLButtonElement;

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe('storefront-mobile-nav');
    expect(element.querySelector('#storefront-mobile-nav')).toBeNull();

    toggle.click();
    fixture.detectChanges();

    const updated = element.querySelector('#storefront-mobile-nav');
    expect(updated).not.toBeNull();
    expect(updated?.querySelector('.nav')?.getAttribute('data-orientation')).toBe('vertical');
    expect(element.querySelector('button.menu-toggle')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('wires the shared theme toggle to the central theme state', () => {
    const { fixture, element } = setup();
    const themes = TestBed.inject(ThemeService);

    expect(themes.theme()).toBe('light');
    expect(
      element.querySelector('flux-theme-toggle button.toggle')?.getAttribute('aria-label'),
    ).toBe('Switch to dark theme');

    (element.querySelector('flux-theme-toggle button.toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(themes.theme()).toBe('dark');
    expect(
      element.querySelector('flux-theme-toggle button.toggle')?.getAttribute('aria-label'),
    ).toBe('Switch to light theme');
  });
});
