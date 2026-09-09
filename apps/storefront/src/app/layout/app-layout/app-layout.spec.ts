import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { provideApi, provideAppEnvironment } from '@flux/api';
import { provideAuthRecovery } from '@flux/auth';
import { AppLayout } from './app-layout';

function setup(): HTMLElement {
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
  return fixture.nativeElement as HTMLElement;
}

describe('AppLayout', () => {
  it('composes the skip link, header, outlet, and footer in order', () => {
    const element = setup();

    const skip = element.querySelector('a.skip-link');
    expect(skip?.getAttribute('href')).toBe('#main-content');
    expect(element.querySelector('storefront-header')).not.toBeNull();
    expect(element.querySelector('main#main-content router-outlet')).not.toBeNull();
    expect(element.querySelector('storefront-footer')).not.toBeNull();

    const order = [...element.children].map((child) => child.tagName.toLowerCase());
    expect(order).toEqual(['a', 'storefront-header', 'main', 'storefront-footer']);
  });
});
