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
        loadComponent: () => import('./features/home/home-page').then((m) => m.HomePage),
      },
      {
        path: '',
        loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
      },
      {
        path: 'catalog',
        loadChildren: () =>
          import('./features/catalog/catalog.routes').then((m) => m.catalogRoutes),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./layout/not-found-page').then((m) => m.NotFoundPage),
  },
];
