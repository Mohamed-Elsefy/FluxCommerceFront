import { Routes } from '@angular/router';
import { AppLayout } from './layout/app-layout/app-layout';

/**
 * Storefront root routes (standalone).
 *
 * Convention: the application shell stays eager while pages lazy-load
 * through `loadComponent`. Feature areas arriving in later phases follow
 * the same pattern (lazy `loadChildren` feature shells or `loadComponent`
 * pages) and live under `./features/<feature>/`.
 */
export const routes: Routes = [
  {
    path: '',
    component: AppLayout,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/home/pages/home-page/home-page').then((m) => m.HomePage),
      },
      {
        path: '',
        loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
      },
      {
        // Sub-Phase 6.1 — more specific than 'catalog' below, so this entry
        // must stay first: 'catalog' alone would otherwise swallow the
        // 'catalog/products/:id' prefix. Serves /catalog/products/:id.
        path: 'catalog/products',
        loadChildren: () =>
          import('./features/product-details/product-details.routes').then(
            (m) => m.productDetailsRoutes,
          ),
      },
      {
        path: 'catalog',
        loadChildren: () =>
          import('./features/catalog/catalog.routes').then((m) => m.catalogRoutes),
      },
      {
        // Sub-Phase 7.4 — customer cart area serving /cart (lazy feature
        // boundary with route-provided CartState; identity establishment
        // and merge wiring arrive in Sub-Phases 7.5–7.7).
        path: 'cart',
        loadChildren: () => import('./features/cart/cart.routes').then((m) => m.cartRoutes),
      },
      {
        // Sub-Phase 8.2 — checkout feature boundary serving /checkout
        // (lazy, auth-guarded at the feature boundary; the page and the
        // feature-scoped CheckoutState arrive in Sub-Phases 8.3–8.4).
        path: 'checkout',
        loadChildren: () =>
          import('./features/checkout/checkout.routes').then((m) => m.checkoutRoutes),
      },
      {
        // Sub-Phase 9.2 — payments feature boundary serving
        // /payment/:orderId and /payment/:orderId/result (lazy,
        // auth-guarded at the feature boundary; skeleton pages only —
        // data access, state, and provider wiring arrive in 9.3–9.5+).
        path: 'payment',
        loadChildren: () =>
          import('./features/payments/payments.routes').then((m) => m.paymentsRoutes),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./layout/not-found-page').then((m) => m.NotFoundPage),
  },
];
