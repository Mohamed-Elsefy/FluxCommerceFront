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
 * The skip link resolves through the layout bundle; the pending/failure
 * chrome stays shell-hardcoded English with the rest of the transient
 * shell states.
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
import { CultureService } from '@flux/i18n';
import { StorefrontFooter } from '../footer/footer';
import { StorefrontHeader } from '../header/header';
import { LAYOUT_TRANSLATION_KEYS, translateLayoutKey } from '../layout-translations';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, StorefrontHeader, StorefrontFooter, LoadingIndicator, ErrorState],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLayout {
  private readonly router = inject(Router);
  private readonly cultures = inject(CultureService);

  /** Localized skip-link label for the active culture. */
  protected readonly skipLabel = computed(() =>
    translateLayoutKey(this.cultures.culture(), LAYOUT_TRANSLATION_KEYS.skipLink),
  );

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
