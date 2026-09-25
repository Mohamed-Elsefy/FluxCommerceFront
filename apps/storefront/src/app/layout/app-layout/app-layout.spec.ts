import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { provideApi, provideAppEnvironment } from '@flux/api';
import { provideAuthRecovery } from '@flux/auth';
import { AppLayout } from './app-layout';

@Component({ selector: 'app-stub-a', template: '<p>stub a</p>' })
class StubA {}

@Component({ selector: 'app-stub-b', template: '<p>stub b</p>' })
class StubB {}

function setup(): { element: HTMLElement; fixture: ComponentFixture<AppLayout> } {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'a', component: StubA },
        { path: 'b', component: StubB },
        {
          // Rejected lazy boundary: stands in for a chunk that cannot load.
          path: 'boom',
          loadChildren: () => Promise.reject(new Error('chunk failed')),
        },
      ]),
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
  return { element: fixture.nativeElement as HTMLElement, fixture };
}

describe('AppLayout', () => {
  it('composes the skip link, header, outlet, and footer in order', () => {
    const { element } = setup();

    const skip = element.querySelector('a.skip-link');
    expect(skip?.getAttribute('href')).toBe('#main-content');
    expect(element.querySelector('storefront-header')).not.toBeNull();
    expect(element.querySelector('main#main-content router-outlet')).not.toBeNull();
    expect(element.querySelector('storefront-footer')).not.toBeNull();

    const order = [...element.children].map((child) => child.tagName.toLowerCase());
    expect(order).toEqual(['a', 'storefront-header', 'main', 'storefront-footer']);
  });

  it('shows no pending or failure chrome when idle', () => {
    const { element } = setup();

    expect(element.querySelector('flux-loading-indicator')).toBeNull();
    expect(element.querySelector('flux-error-state')).toBeNull();
    expect(element.querySelector('router-outlet')).not.toBeNull();
  });

  it('indicates pending navigation and clears it on success (11.6)', async () => {
    const { element, fixture } = setup();
    const router = TestBed.inject(Router);

    const pending = router.navigate(['/a']);
    fixture.detectChanges();
    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();

    await pending;
    fixture.detectChanges();
    expect(element.querySelector('flux-loading-indicator')).toBeNull();
    expect(element.querySelector('flux-error-state')).toBeNull();
    expect(element.textContent).toContain('stub a');
  });

  it('replaces the outlet with a retryable error when lazy loading fails (11.6)', async () => {
    const { element, fixture } = setup();
    const router = TestBed.inject(Router);

    await router.navigate(['/boom']).catch(() => undefined);
    fixture.detectChanges();

    expect(element.querySelector('flux-loading-indicator')).toBeNull();
    expect(element.querySelector('router-outlet')).toBeNull();
    const error = element.querySelector('flux-error-state');
    expect(error?.textContent).toContain('This page could not be loaded');
  });

  it('retries the failed navigation from the error state (11.6)', async () => {
    const { element, fixture } = setup();
    const router = TestBed.inject(Router);

    await router.navigate(['/boom']).catch(() => undefined);
    fixture.detectChanges();

    (element.querySelector('flux-error-state button') as HTMLButtonElement | null)?.click();
    fixture.detectChanges();
    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();

    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelector('flux-error-state')).not.toBeNull();
  });

  it('recovers the outlet on the next successful navigation (11.6)', async () => {
    const { element, fixture } = setup();
    const router = TestBed.inject(Router);

    await router.navigate(['/boom']).catch(() => undefined);
    fixture.detectChanges();
    expect(element.querySelector('flux-error-state')).not.toBeNull();

    await router.navigate(['/b']);
    fixture.detectChanges();
    expect(element.querySelector('flux-error-state')).toBeNull();
    expect(element.querySelector('main#main-content router-outlet')).not.toBeNull();
    expect(element.textContent).toContain('stub b');
  });
});
