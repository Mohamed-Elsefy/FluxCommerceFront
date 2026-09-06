import { Routes } from '@angular/router';

/**
 * Storefront authentication routes (Sub-Phase 2.4).
 *
 * Lazy pages under the application shell. Email verification, password
 * recovery, account, and guarded routes arrive in later sub-phases —
 * this table grows then, not now.
 */
export const authRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register-page').then((m) => m.RegisterPage),
  },
];
