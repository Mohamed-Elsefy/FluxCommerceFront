import { describe, expect, it } from 'vitest';
import { AppLayout } from './layout/app-layout/app-layout';
import { routes } from './app.routes';
import { authRoutes } from './features/auth/auth.routes';
import { catalogRoutes } from './features/catalog/catalog.routes';

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

  it('mounts lazy authentication pages under the shell', () => {
    const root = routes.find((route) => route.path === '');
    expect(
      typeof root?.children?.find((route) => route.loadChildren !== undefined)?.loadChildren,
    ).toBe('function');

    const paths = authRoutes.map((route) => route.path).sort();
    expect(paths).toEqual([
      'forgot-password',
      'login',
      'register',
      'resend-verification',
      'reset-password',
      'verify-email',
    ]);
    for (const route of authRoutes) {
      expect(typeof route.loadComponent).toBe('function');
    }
  });

  it('mounts the lazy catalog feature boundary under the shell', async () => {
    const root = routes.find((route) => route.path === '');
    const catalog = root?.children?.find((route) => route.path === 'catalog');

    expect(typeof catalog?.loadChildren).toBe('function');
    expect(catalogRoutes).toHaveLength(1);
    expect(catalogRoutes[0]?.path).toBe('');
  });

  it('routes the catalog entry point to the lazy discovery page', () => {
    const discovery = catalogRoutes[0]?.children?.find((route) => route.path === '');

    expect(typeof discovery?.loadComponent).toBe('function');
  });
});
