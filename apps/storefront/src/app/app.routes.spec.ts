import { describe, expect, it } from 'vitest';
import { AppLayout } from './layout/app-layout';
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
});
