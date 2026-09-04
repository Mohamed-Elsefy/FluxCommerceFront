import { Routes } from '@angular/router';
import { AppLayout } from './layout/app-layout';

/**
 * Admin root routes (standalone).
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
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./layout/not-found-page').then((m) => m.NotFoundPage),
  },
];
