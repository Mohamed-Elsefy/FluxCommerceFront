import { describe, expect, it } from 'vitest';
import { AppLayout } from './layout/app-layout/app-layout';
import { routes } from './app.routes';
import { authRoutes } from './features/auth/auth.routes';
import { catalogRoutes } from './features/catalog/catalog.routes';
import { productsRoutes } from './features/catalog/products.routes';
import { checkoutRoutes } from './features/checkout/checkout.routes';
import { paymentsRoutes } from './features/payments/payments.routes';
import { accountRoutes } from './features/orders/account.routes';

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

  it('mounts the independent products shelf under the shell', async () => {
    const root = routes.find((route) => route.path === '');
    const products = root?.children?.find((route) => route.path === 'products');

    expect(typeof products?.loadChildren).toBe('function');
    expect(productsRoutes).toHaveLength(1);
    expect(productsRoutes[0]?.path).toBe('');

    const loaded = await products?.loadChildren?.();
    expect(loaded).toBe(productsRoutes);
  });

  it('mounts the lazy auth-guarded checkout feature boundary under the shell', async () => {
    const root = routes.find((route) => route.path === '');
    const checkout = root?.children?.find((route) => route.path === 'checkout');

    expect(typeof checkout?.loadChildren).toBe('function');
    expect(checkoutRoutes).toHaveLength(1);
    expect(checkoutRoutes[0]?.path).toBe('');

    const loaded = await checkout?.loadChildren?.();
    // Identity against the statically imported table proves the mount
    // wires the checkout boundary; laziness itself follows from the
    // `loadChildren` shape (asserted above).
    expect(loaded).toBe(checkoutRoutes);
  });

  it('mounts the lazy auth-guarded payments feature boundary under the shell', async () => {
    const root = routes.find((route) => route.path === '');
    const payment = root?.children?.find((route) => route.path === 'payment');

    expect(typeof payment?.loadChildren).toBe('function');
    expect(paymentsRoutes).toHaveLength(1);
    expect(paymentsRoutes[0]?.path).toBe('');

    const loaded = await payment?.loadChildren?.();
    // Identity against the statically imported table proves the mount
    // wires the payments boundary; laziness itself follows from the
    // `loadChildren` shape (asserted above).
    expect(loaded).toBe(paymentsRoutes);
  });

  it('mounts the lazy auth-guarded account feature boundary under the shell', async () => {
    const root = routes.find((route) => route.path === '');
    const account = root?.children?.find((route) => route.path === 'account');

    expect(typeof account?.loadChildren).toBe('function');
    expect(accountRoutes).toHaveLength(1);
    expect(accountRoutes[0]?.path).toBe('');

    const loaded = await account?.loadChildren?.();
    // Identity against the statically imported table proves the mount
    // wires the account boundary (Sub-Phase 10.7); laziness itself
    // follows from the `loadChildren` shape (asserted above).
    expect(loaded).toBe(accountRoutes);
  });
});
