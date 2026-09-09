import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { provideApi, provideAppEnvironment } from '@flux/api';
import { provideAuthRecovery } from '@flux/auth';
import { AdminHeader } from './header';

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
  it('renders the application context and the admin user area', () => {
    const { element } = setup();

    expect(element.querySelector('.context')?.textContent).toBe('FluxCommerce Admin');
    expect(element.querySelector('auth-nav')).not.toBeNull();
  });

  it('emits menuToggle when the drawer toggle is activated', () => {
    const { fixture, element } = setup();
    let emitted = 0;
    fixture.componentInstance.menuToggle.subscribe(() => (emitted += 1));

    (element.querySelector('button.menu-toggle') as HTMLButtonElement).click();

    expect(emitted).toBe(1);
  });
});
