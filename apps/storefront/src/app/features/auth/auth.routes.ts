import { Routes } from '@angular/router';

/**
 * Storefront authentication routes (Sub-Phases 2.4 + 2.10).
 *
 * Lazy pages under the application shell. Account, guarded routes, and
 * change-password arrive in later sub-phases — this table grows then,
 * not now.
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
  {
    path: 'verify-email',
    loadComponent: () => import('./pages/verify-email-page').then((m) => m.VerifyEmailPage),
  },
  {
    path: 'resend-verification',
    loadComponent: () =>
      import('./pages/resend-verification-page').then((m) => m.ResendVerificationPage),
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./pages/forgot-password-page').then((m) => m.ForgotPasswordPage),
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./pages/reset-password-page').then((m) => m.ResetPasswordPage),
  },
];
