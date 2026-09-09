/**
 * Storefront header for Sub-Phase 3.6 — Storefront Application Shell.
 *
 * Composition only: brand wordmark, desktop `StorefrontNav`, mobile menu
 * toggle with a vertical `StorefrontNav` panel, and the Phase 2 `AuthNav`
 * for Anonymous/Authenticated entry points. No auth logic lives here —
 * `AuthService` signals stay inside `AuthNav`; this shell never replicates
 * them.
 *
 * The mobile panel is the same `StorefrontNav` component in vertical
 * orientation (one component, responsive placement — no device duplicates).
 * Closed by default on server and client alike, so SSR and hydration render
 * identical markup. Styling is token-driven with a CSS-only breakpoint:
 * the desktop nav shows from tablet widths up, the toggle below that.
 *
 * Integration notes (deliberately not built here):
 * - Cart entry docks here once the Phase 7 cart route exists; linking to a
 *   nonexistent route today would only produce 404s.
 * - Theme switching UI arrives with Sub-Phase 3.10 (`ThemeToggle`); the
 *   header already renders under the centralized theme via tokens.
 *
 * SSR/hydration safe: local toggle signal only, no browser APIs. RTL safe:
 * logical properties and direction-aware flex flow only.
 */

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthNav } from '@flux/auth';
import { Container } from '@flux/ui';
import { StorefrontNav, type StorefrontNavItem } from '../navigation/navigation';

@Component({
  selector: 'storefront-header',
  imports: [RouterLink, StorefrontNav, AuthNav, Container],
  templateUrl: './header.html',
  styleUrl: './header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StorefrontHeader {
  /** Main destinations — only routes that exist (business entries arrive with their phases). */
  readonly mainNav: readonly StorefrontNavItem[] = [{ label: 'Home', route: '/' }];

  /** Mobile menu visibility (local UI state; closed on server and client). */
  readonly menuOpen = signal(false);

  /** Toggles the mobile navigation panel. */
  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }
}
