import { describe, expect, it } from 'vitest';
import { authGuard, roleGuard } from '@flux/auth';
import { AppLayout } from './layout/app-layout/app-layout';
import { routes } from './app.routes';

describe('routes', () => {
  it('exposes the anonymous login entry point as a lazy feature boundary', () => {
    const auth = routes.find((route) => route.path === '' && route.loadChildren !== undefined);

    expect(typeof auth?.loadChildren).toBe('function');
  });

  it('serves a lazy forbidden page outside the protected shell', () => {
    const forbidden = routes.find((route) => route.path === 'forbidden');

    expect(typeof forbidden?.loadComponent).toBe('function');
    expect(forbidden?.canActivate).toBeUndefined();
  });

  it('protects the portal shell with the guard chain and admin roles', () => {
    const shell = routes.find((route) => route.path === '' && route.component === AppLayout);

    expect(shell?.canActivate).toEqual([authGuard, roleGuard]);
    expect(shell?.data?.['roles']).toEqual(['Admin', 'SuperAdmin']);
  });

  it('keeps the shell home and dashboard lazy inside the protected shell', () => {
    const shell = routes.find((route) => route.path === '' && route.component === AppLayout);
    const home = shell?.children?.find((route) => route.path === '');
    const dashboard = shell?.children?.find((route) => route.path === 'dashboard');

    expect(typeof home?.loadComponent).toBe('function');
    expect(typeof dashboard?.loadComponent).toBe('function');
  });

  it('mounts the catalog feature as a lazy boundary inside the protected shell', () => {
    const shell = routes.find((route) => route.path === '' && route.component === AppLayout);
    const catalog = shell?.children?.find((route) => route.path === 'catalog');

    expect(typeof catalog?.loadChildren).toBe('function');
    expect(catalog?.canActivate).toBeUndefined();
  });

  it('mounts the inventory feature as a lazy boundary inside the protected shell', () => {
    const shell = routes.find((route) => route.path === '' && route.component === AppLayout);
    const inventory = shell?.children?.find((route) => route.path === 'inventory');

    expect(typeof inventory?.loadChildren).toBe('function');
    expect(inventory?.canActivate).toBeUndefined();
  });

  it('falls back to a lazy not-found page', () => {
    const fallback = routes.find((route) => route.path === '**');

    expect(typeof fallback?.loadComponent).toBe('function');
  });
});
