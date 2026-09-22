import { Routes } from '@angular/router';
import { authGuard } from '@flux/auth';
import { AccountShell } from './components/account-shell/account-shell';
import { AccountState } from './state/account-state';

/**
 * Storefront Account feature routes (Sub-Phase 10.2 — Customer Account
 * & Profile).
 *
 * Mounted at `account` in `app.routes.ts`, so the entries below serve
 * `/account` (redirects to the profile), `/account/profile` (profile
 * page), and `/account/orders/*` (orders area — the route table stays
 * empty until §10.3 builds the list page).
 *
 * The lazy boundary, the authentication guard, and the feature-scoped
 * state live on the shell parent: the account area is `[Authorize]`
 * (plus ownership on every order read), so anonymous entry is blocked
 * here by the shared Phase 2 `authGuard` (redirect to
 * `/login?returnUrl=`). Every account page gets the same `AccountState`
 * instance (never a global store — `AccountState` has no `providedIn`
 * and registers here only).
 *
 * Architectural flow (target — `ARCHITECTURE.md` §10; orders state and
 * pages land in §§10.3–10.4):
 *
 * ```text
 * AccountShell (components/ — section nav, logout, child outlet)
 *     ↓ ProfilePage (pages/ — orchestration only)
 *     ↓ AccountState (state/ — feature-owned local Signals, provided here)
 *     ↓ IdentityApiService (@flux/api — GET /auth/me transport)
 *     ↓ AuthService (@flux/auth — session re-sync target)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Identity API
 * ```
 */
export const accountRoutes: Routes = [
  {
    path: '',
    component: AccountShell,
    providers: [AccountState],
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'profile',
        pathMatch: 'full',
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile-page/profile-page').then((m) => m.ProfilePage),
      },
      {
        // Sub-Phase 10.3 seam — the orders route table is still empty
        // (see `./orders.routes`), so this entry matches nothing yet and
        // falls through to the not-found page until the list page lands.
        path: 'orders',
        loadChildren: () => import('./orders.routes').then((m) => m.ordersRoutes),
      },
    ],
  },
];
