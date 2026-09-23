import { Routes } from '@angular/router';
import { authGuard } from '@flux/auth';
import { AccountShell } from './components/account-shell/account-shell';
import { AccountState } from './state/account-state';

/**
 * Storefront Account feature routes (Sub-Phases 10.2 — Customer
 * Account & Profile — and 10.7 — Routing, Authorization & Account UX).
 *
 * Mounted at `account` in `app.routes.ts`, so the entries below serve
 * `/account` (redirects to the profile), `/account/profile` (profile
 * page), `/account/orders` (orders list), and `/account/orders/:orderId`
 * (order details, via `./orders.routes`). All four support direct URL
 * deep-linking through the lazy boundary.
 *
 * The lazy boundary, the authentication guard, and the feature-scoped
 * state live on the shell parent: the account area is `[Authorize]`
 * (plus ownership on every order read), so anonymous entry — including
 * anonymous deep links — is blocked here by the shared Phase 2
 * `authGuard` (redirect to `/login?returnUrl=` so login returns the
 * customer to the attempted destination).
 *
 * Security boundary (§10.7 — architectural rule, enforced by
 * construction): this guard is NAVIGATION/UX protection only. It is
 * NOT the security boundary — the backend stays solely authoritative
 * for authentication, authorization, customer ownership, and access to
 * order resources (every order read re-checks ownership server-side
 * and masks foreign ids as `404`). No route, link visibility rule, or
 * client-side check here grants or implies access.
 *
 * Every account page gets the same `AccountState` instance (never a
 * global store — `AccountState` has no `providedIn` and registers here
 * only).
 *
 * Architectural flow (`ARCHITECTURE.md` §10):
 *
 * ```text
 * AccountShell (components/ — section nav, logout, child outlet)
 *     ↓ ProfilePage / OrdersListPage / OrderDetailsPage (pages/)
 *     ↓ AccountState / OrdersListState / OrderDetailsState (state/ —
 *       feature-owned local Signals, provided on their entries)
 *     ↓ IdentityApiService / OrdersApiService (@flux/api transports)
 *     ↓ AuthService (@flux/auth — session, read-only outside logout)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend APIs
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
        // Orders area seam — serves `/account/orders` (list) and
        // `/account/orders/:orderId` (details) via `./orders.routes`.
        path: 'orders',
        loadChildren: () => import('./orders.routes').then((m) => m.ordersRoutes),
      },
    ],
  },
];
