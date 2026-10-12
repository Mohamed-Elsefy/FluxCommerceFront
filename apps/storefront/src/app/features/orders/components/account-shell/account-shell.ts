/**
 * Account shell for Sub-Phase 10.2 — Customer Account & Profile.
 *
 * Route container for the authenticated account area: section heading,
 * signed-in identity line (read-only session display), section
 * navigation (`AccountNav` — Profile and Orders), logout action, and
 * the child outlet. Composes the feature-scoped `AccountState`
 * grandchild pages consume — the state itself is provided on the
 * `accountRoutes` parent, never here.
 *
 * Session rules (Phase 2 ownership — reused, never replicated):
 * - `AuthService` signals are consumed read-only; this shell writes
 *   nothing except invoking `logout()` (revoke + cleanup + redirect
 *   inside the service). Entry protection stays in the route guard —
 *   anonymous sessions never reach this component.
 * - Logout mirrors the shared `AuthNav` behavior: single-flight guard,
 *   action disabled with progress copy while the request is in flight.
 *
 * Copy resolves through the feature-owned account bundle against the
 * active `CultureService.culture()`. No document-title work here (each
 * child page owns its title).
 *
 * SSR/hydration safe: signals and router templating only — no browser
 * APIs. RTL safe: logical properties only, no direction branching.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 10.3/10.4 — no orders content (the outlet hosts it when it lands).
 * - Profile editing (no backend contract supports it).
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '@flux/auth';
import { CultureService } from '@flux/i18n';
import { ordersPath } from '../../models/orders.models';
import { ACCOUNT_PROFILE_PATH } from '../../models/account.models';
import { ACCOUNT_TRANSLATION_KEYS, translateAccountKey } from '../../i18n/account-translations';
import { AccountNav, type AccountNavItem } from '../account-nav/account-nav';

@Component({
  selector: 'account-shell',
  imports: [RouterOutlet, AccountNav],
  templateUrl: './account-shell.html',
  styleUrl: './account-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountShell {
  /** Central authentication state (read-only signals; `logout()` action). */
  protected readonly auth = inject(AuthService);
  private readonly cultures = inject(CultureService);

  /** Logout request in flight: action disabled with progress copy. */
  readonly isLoggingOut = signal(false);

  /** Localized shell copy for the active culture. */
  readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      title: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.shellTitle),
      navLabel: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.shellNavLabel),
      logout: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.shellLogout),
      loggingOut: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.shellLoggingOut),
      navItems: [
        {
          label: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.navProfile),
          route: ACCOUNT_PROFILE_PATH,
        },
        {
          label: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.navOrders),
          route: ordersPath(),
        },
        {
          label: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.navPayments),
          route: '/payment/mine',
        },
      ] as readonly AccountNavItem[],
    };
  });

  /** Localized signed-in line, or `null` when no session user is present. */
  readonly signedInAs = computed(() => {
    const email = this.auth.currentUser()?.email ?? null;
    if (email === null || email === '') {
      return null;
    }
    return translateAccountKey(this.cultures.culture(), ACCOUNT_TRANSLATION_KEYS.shellSignedInAs, {
      email,
    });
  });

  /** Signs out (revoke + cleanup + redirect inside `AuthService`) once. */
  logout(): void {
    if (this.isLoggingOut()) {
      return;
    }
    this.isLoggingOut.set(true);
    this.auth.logout().subscribe({
      complete: () => this.isLoggingOut.set(false),
      error: () => this.isLoggingOut.set(false),
    });
  }
}
