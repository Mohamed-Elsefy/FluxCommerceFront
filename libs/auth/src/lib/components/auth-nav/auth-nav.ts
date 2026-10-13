/**
 * Shell account navigation for Sub-Phase 2.13 — Authentication UI
 * Integration.
 *
 * A minimal structural widget shared by the Storefront and Admin shells.
 * It renders purely from central `AuthService` signals — shells and
 * features must not replicate auth-driven navigation state:
 *
 * ```text
 * initializing  → neutral "checking session" placeholder (SSR-identical
 *                 on server and client: both start uninitialized, so
 *                 hydration never mismatches here)
 * anonymous     → Login / Register links (each rendered only when its
 *                 route input is non-null — the Admin app has no login or
 *                 registration routes yet, so it hides both rather than
 *                 linking into 404s; admin sign-in flows arrive later)
 * authenticated → current-user details text, optional Account entry, and
 *                 a Logout action (disabled with progress copy while the
 *                 logout request is in flight)
 * ```
 *
 * State coverage note: Initializing / Anonymous / Authenticated / Loading
 * (logout pending) live here. Error / Unauthorized / Forbidden are
 * page-level states by design — form alerts (`flux-error-state`), the
 * `/forbidden` route, and normalized `ApiError` handling already own them;
 * navigation elements cannot meaningfully "be" those states.
 *
 * Styling is deliberately structural (no tokens, no themes, no direction
 * assumptions beyond logical properties): Phase 3 owns the Design System.
 *
 * Uses `@Input()` decorators (not signal I/O): `libs/*` specs run under
 * the raw Vitest runner, which lacks the Angular compiler transform that
 * registers signal inputs — decorator metadata stays runtime-readable
 * (Sub-Phase 2.14 covers this widget).
 */

import { ChangeDetectionStrategy, Component, Input, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../state/auth.service';

@Component({
  selector: 'auth-nav',
  imports: [RouterLink],
  templateUrl: './auth-nav.html',
  styleUrl: './auth-nav.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthNav {
  /** Central authentication state (read-only signals). */
  readonly auth = inject(AuthService);

  /** Login destination; null hides the link (apps without that route). */
  @Input() loginRoute: string | null = '/login';
  /** Registration destination; null hides the link. */
  @Input() registerRoute: string | null = '/register';
  /**
   * Account entry destination; null hides the link (no account pages
   * exist yet — Phase 10/12 point these at the real experiences).
   */
  @Input() accountRoute: string | null = null;

  /**
   * Display copy (owner-localized; English defaults preserve the
   * standalone behavior). Labels stay inputs — never a translation
   * dependency — so this shared widget never couples `libs/auth` to a
   * localization library (`ARCHITECTURE.md` §6).
   */
  /** Session-check placeholder. */
  @Input() checkingLabel = 'Checking session…';
  /** Landmark name. */
  @Input() navLabel = 'Account';
  /** Login link text. */
  @Input() loginLabel = 'Login';
  /** Registration link text. */
  @Input() registerLabel = 'Register';
  /** Account link text. */
  @Input() accountLabel = 'Account';
  /** Logout action text. */
  @Input() logoutLabel = 'Logout';
  /** Logout progress text. */
  @Input() loggingOutLabel = 'Signing out…';
  /**
   * Post-logout destination (`AuthService.logout` `redirectTo`).
   * Defaults to `/` (public home) when omitted — apps whose root is
   * guarded (e.g. the Admin portal, where `/` requires a session) must
   * pass their anonymous entry point (e.g. `/login`) so logout always
   * lands on a reachable page instead of a same-url no-op that skips
   * the guards.
   */
  @Input() logoutRedirectTo: string | null = null;

  /** Logout request in flight: action disabled with progress copy. */
  readonly isLoggingOut = signal(false);

  /** Signs out (revoke + cleanup + redirect inside `AuthService`) once. */
  logout(): void {
    if (this.isLoggingOut()) {
      return;
    }
    this.isLoggingOut.set(true);
    this.auth.logout({ redirectTo: this.logoutRedirectTo ?? undefined }).subscribe({
      complete: () => this.isLoggingOut.set(false),
    });
  }
}
