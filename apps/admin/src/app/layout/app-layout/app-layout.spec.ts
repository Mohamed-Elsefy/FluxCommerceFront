import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { provideApi, provideAppEnvironment } from '@flux/api';
import { provideAuthRecovery } from '@flux/auth';
import { AppLayout } from './app-layout';

function setup(): { fixture: ComponentFixture<AppLayout>; element: HTMLElement } {
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
  const fixture = TestBed.createComponent(AppLayout);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('AppLayout', () => {
  it('composes the skip link, sidebar, header, and outlet in order', () => {
    const { element } = setup();

    expect(element.querySelector('a.skip-link')?.getAttribute('href')).toBe('#admin-main');
    expect(element.querySelector('admin-sidebar')).not.toBeNull();
    expect(element.querySelector('admin-header')).not.toBeNull();
    expect(element.querySelector('main#admin-main router-outlet')).not.toBeNull();

    const order = [...element.children].map((child) => child.tagName.toLowerCase());
    expect(order).toEqual(['a', 'admin-sidebar', 'admin-header', 'main']);
  });

  it('opens the drawer from the header toggle and closes it from the overlay', () => {
    const { fixture, element } = setup();

    expect(element.querySelector('admin-sidebar')?.getAttribute('data-drawer')).toBe('closed');
    expect(element.querySelector('.overlay')).toBeNull();

    (element.querySelector('admin-header .menu-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(element.querySelector('admin-sidebar')?.getAttribute('data-drawer')).toBe('open');
    expect(element.querySelector('.overlay')).not.toBeNull();

    (element.querySelector('.overlay') as HTMLElement).click();
    fixture.detectChanges();

    expect(element.querySelector('admin-sidebar')?.getAttribute('data-drawer')).toBe('closed');
    expect(element.querySelector('.overlay')).toBeNull();
  });
});
