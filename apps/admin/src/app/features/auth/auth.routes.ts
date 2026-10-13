import { Routes } from '@angular/router';

/**
 * Admin authentication routes for Sub-Phase 12.1.
 *
 * Lazy anonymous entry point under the Admin application. Registration and
 * recovery routes intentionally do not exist here — the portal authenticates
 * administrators only. This table grows only with admin-scoped auth needs.
 */
export const adminAuthRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login-page').then((m) => m.AdminLoginPage),
  },
];
