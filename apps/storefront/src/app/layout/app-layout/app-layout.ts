/**
 * Storefront application shell for Sub-Phase 3.6.
 *
 * Composition only — Header, Main (router outlet), Footer:
 *
 * ```text
 * Skip link
 *    ↓ StorefrontHeader (brand, nav, mobile menu, auth entry points)
 *    ↓ Main → Router Outlet (lazy pages; shell stays eager)
 *    ↓ StorefrontFooter (brand, explore group, legal line)
 * ```
 *
 * No routing logic, no state, no business UI: pages own their experience
 * and arrive lazily (see `app.routes.ts`). The skip link targets the main
 * landmark for keyboard users. SSR/hydration safe: static composition of
 * SSR-safe children (closed mobile menu, neutral auth placeholder).
 *
 * Lazy-navigation UX (11.6): chunk fetches leave the outlet empty with no
 * page of their own to show a spinner, so the shell owns the two
 * router-level states — a pending indicator while a navigation is in
 * flight and an error state with retry when a navigation fails (e.g. a
 * lazy chunk that cannot load). Both derive from router events only; on
 * the server no events fire, so SSR renders the plain outlet every time.
 * Copy is shell-hardcoded English, matching the existing shell chrome
 * (skip link, brand) — feature copy stays feature-owned and localized.
 */

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { ErrorState, LoadingIndicator } from '@flux/ui';
import { StorefrontFooter } from '../footer/footer';
import { StorefrontHeader } from '../header/header';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, StorefrontHeader, StorefrontFooter, LoadingIndicator, ErrorState],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLayout {
  private readonly router = inject(Router);

  /** Whether a navigation (including its lazy chunk fetch) is in flight. */
  protected readonly navigating = signal(false);

  /** Whether the last navigation failed (e.g. a chunk that cannot load). */
  protected readonly navigationFailed = signal(false);

  /** Failed navigation target for retry (`null` when nothing failed). */
  private failedUrl: string | null = null;

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.navigating.set(true);
        this.navigationFailed.set(false);
      } else if (event instanceof NavigationEnd || event instanceof NavigationCancel) {
        this.navigating.set(false);
      } else if (event instanceof NavigationError) {
        this.navigating.set(false);
        this.failedUrl = event.url;
        this.navigationFailed.set(true);
      }
    });
  }

  /** Re-attempts the failed navigation (lazy chunk retry). No-op when idle. */
  protected retryNavigation(): void {
    if (this.failedUrl !== null) {
      // The rejection carries the same failure the NavigationError event
      // already surfaced above — handling the promise only avoids
      // unhandled-rejection noise on repeated failures.
      void this.router.navigateByUrl(this.failedUrl).catch(() => undefined);
    }
  }
}
