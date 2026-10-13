/**
 * Account section navigation for Sub-Phase 10.2 — Customer Account &
 * Profile.
 *
 * Presentational only: renders a link list from `items` (account-owned
 * destinations — Profile and Orders, both real routes in the account
 * area). Active-section styling comes from `routerLinkActive` with
 * `aria-current="page"`; keyboard behavior comes free from native
 * anchors. One component serves every placement via `orientation` — no
 * duplicates.
 *
 * Uses `@Input()` decorators (not signal I/O) for consistency with the
 * shell `StorefrontNav` it mirrors. Holds no state, performs no HTTP,
 * touches no session — the shell owns the items and the logout action.
 *
 * SSR/hydration safe: pure markup + CSS, no browser APIs. RTL safe:
 * flex flow follows the document direction; logical properties only.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Single account navigation entry: visible label plus an account route. */
export interface AccountNavItem {
  readonly label: string;
  readonly route: string;
}

@Component({
  selector: 'account-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './account-nav.html',
  styleUrl: './account-nav.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountNav {
  /** Destinations to render (account-owned; only existing routes). */
  @Input() items: readonly AccountNavItem[] = [];
  /** Accessible landmark name (unique per placement). */
  @Input() label = 'Account';
}
