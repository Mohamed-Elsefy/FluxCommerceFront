import { describe, expect, it } from 'vitest';
import { authGuard, roleGuard } from '@flux/auth';
import { AppLayout } from './layout/app-layout/app-layout';
import { routes } from './app.routes';

describe('routes', () => {
  it('mounts the eager shell with a lazy home page', () => {
    const root = routes.find((route) => route.path === '');

    expect(root?.component).toBe(AppLayout);
    expect(typeof root?.children?.find((route) => route.path === '')?.loadComponent).toBe(
      'function',
    );
  });

  it('falls back to a lazy not-found page', () => {
    const fallback = routes.find((route) => route.path === '**');

    expect(typeof fallback?.loadComponent).toBe('function');
  });

  it('protects the dashboard entry with the guard chain and admin roles', () => {
    const root = routes.find((route) => route.path === '');
    const dashboard = root?.children?.find((route) => route.path === 'dashboard');

    expect(dashboard?.canActivate).toEqual([authGuard, roleGuard]);
    expect(dashboard?.data?.['roles']).toEqual(['Admin', 'SuperAdmin']);
    expect(typeof dashboard?.loadComponent).toBe('function');
  });

  it('serves a lazy forbidden page', () => {
    const root = routes.find((route) => route.path === '');
    const forbidden = root?.children?.find((route) => route.path === 'forbidden');

    expect(typeof forbidden?.loadComponent).toBe('function');
  });
});
