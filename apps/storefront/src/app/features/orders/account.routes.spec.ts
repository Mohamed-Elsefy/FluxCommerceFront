/**
 * Route tests for the Sub-Phase 10.2 `accountRoutes`.
 *
 * Covers the lazy account boundary: a single pathless shell parent
 * carrying the `AccountShell` container, the feature-scoped
 * `AccountState` (never a global store), and the shared Phase 2
 * `authGuard` (the account area is `[Authorize]` — anonymous entry
 * redirects to `/login?returnUrl=`), with the default child redirecting
 * to the lazily loaded profile page and the `orders` entry delegating
 * to the (still empty — §10.3) orders route table.
 */

import { describe, expect, it } from 'vitest';
import { authGuard } from '@flux/auth';
import { accountRoutes } from './account.routes';
import { AccountShell } from './components/account-shell/account-shell';
import { ProfilePage } from './pages/profile-page/profile-page';
import { AccountState } from './state/account-state';
import { ordersRoutes } from './orders.routes';

describe('accountRoutes', () => {
  it('exposes a single pathless guarded shell parent entry', () => {
    expect(accountRoutes).toHaveLength(1);
    expect(accountRoutes[0]?.path).toBe('');
    expect(accountRoutes[0]?.component).toBe(AccountShell);
    expect(accountRoutes[0]?.canActivate).toContain(authGuard);
  });

  it('provides the feature-scoped AccountState on the parent entry', () => {
    expect(accountRoutes[0]?.providers).toContain(AccountState);
  });

  it('redirects the default child to the profile section', () => {
    const child = accountRoutes[0]?.children?.[0];

    expect(child?.path).toBe('');
    expect(child).toMatchObject({ redirectTo: 'profile', pathMatch: 'full' });
  });

  it('lazy-loads the profile page on the profile child', async () => {
    const child = accountRoutes[0]?.children?.[1];

    expect(child?.path).toBe('profile');
    expect(typeof child?.loadComponent).toBe('function');

    const page = await child?.loadComponent?.();
    // Identity against the statically imported page proves the route wires
    // the right component; laziness itself follows from the `loadComponent`
    // shape (asserted above) and is enforced by the architecture audit.
    expect(page).toBe(ProfilePage);
  });

  it('delegates the orders child to the orders route table', async () => {
    const child = accountRoutes[0]?.children?.[2];

    expect(child?.path).toBe('orders');
    expect(typeof child?.loadChildren).toBe('function');

    const routes = await child?.loadChildren?.();
    expect(routes).toBe(ordersRoutes);
  });
});
