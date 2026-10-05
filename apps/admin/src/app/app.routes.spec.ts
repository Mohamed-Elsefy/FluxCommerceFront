import { describe, expect, it } from 'vitest';
import { authGuard, permissionGuard, roleGuard } from '@flux/auth';
import { DashboardApiService } from './features/dashboard/data-access/dashboard-api.service';
import { DashboardState } from './features/dashboard/state/dashboard-state';
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

  it('redirects the shell root to the dashboard and keeps it lazy', () => {
    const shell = routes.find((route) => route.path === '' && route.component === AppLayout);
    const root = shell?.children?.find((route) => route.path === '');
    const dashboard = shell?.children?.find((route) => route.path === 'dashboard');

    expect(root?.redirectTo).toBe('dashboard');
    expect(root?.loadComponent).toBeUndefined();
    expect(typeof dashboard?.loadComponent).toBe('function');
  });

  it('leaves the dashboard open to every portal user (adaptive sections, no permission gate)', () => {
    const shell = routes.find((route) => route.path === '' && route.component === AppLayout);
    const dashboard = shell?.children?.find((route) => route.path === 'dashboard');

    expect(dashboard?.canActivate).toBeUndefined();
    expect(dashboard?.data?.['permissions']).toBeUndefined();
  });

  it('provides the dashboard transport seam and state on the dashboard entry', () => {
    const shell = routes.find((route) => route.path === '' && route.component === AppLayout);
    const dashboard = shell?.children?.find((route) => route.path === 'dashboard');

    expect(dashboard?.providers).toEqual([DashboardApiService, DashboardState]);
  });

  it('mounts the catalog feature as a lazy boundary inside the protected shell', () => {
    const shell = routes.find((route) => route.path === '' && route.component === AppLayout);
    const catalog = shell?.children?.find((route) => route.path === 'catalog');

    expect(typeof catalog?.loadChildren).toBe('function');
    expect(catalog?.canActivate).toEqual([permissionGuard]);
    expect(catalog?.data?.['permissions']).toEqual(['catalog.manage']);
  });

  it('mounts the inventory feature as a lazy boundary inside the protected shell', () => {
    const shell = routes.find((route) => route.path === '' && route.component === AppLayout);
    const inventory = shell?.children?.find((route) => route.path === 'inventory');

    expect(typeof inventory?.loadChildren).toBe('function');
    expect(inventory?.canActivate).toEqual([permissionGuard]);
    expect(inventory?.data?.['permissions']).toEqual(['inventory.read']);
  });

  it('mounts the orders feature as a lazy boundary inside the protected shell', () => {
    const shell = routes.find((route) => route.path === '' && route.component === AppLayout);
    const orders = shell?.children?.find((route) => route.path === 'orders');

    expect(typeof orders?.loadChildren).toBe('function');
    expect(orders?.canActivate).toEqual([permissionGuard]);
    expect(orders?.data?.['permissions']).toEqual(['orders.read']);
  });

  it('mounts the payments feature as a lazy boundary with read/stats permissions', () => {
    const shell = routes.find((route) => route.path === '' && route.component === AppLayout);
    const payments = shell?.children?.find((route) => route.path === 'payments');

    expect(typeof payments?.loadChildren).toBe('function');
    expect(payments?.canActivate).toEqual([permissionGuard]);
    expect(payments?.data?.['permissions']).toEqual(['payments.read', 'payments.stats']);
  });

  it('mounts the users feature as a permission-gated lazy boundary', () => {
    const shell = routes.find((route) => route.path === '' && route.component === AppLayout);
    const users = shell?.children?.find((route) => route.path === 'users');

    expect(typeof users?.loadChildren).toBe('function');
    expect(users?.canActivate).toEqual([permissionGuard]);
    expect(users?.data?.['permissions']).toEqual(['users.read', 'users.manage', 'admins.create']);
  });

  it('falls back to a lazy not-found page', () => {
    const fallback = routes.find((route) => route.path === '**');

    expect(typeof fallback?.loadComponent).toBe('function');
  });
});
