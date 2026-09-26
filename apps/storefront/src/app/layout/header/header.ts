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
 * Theme switching is composed here (Sub-Phase 3.10): the shared dumb
 * `ThemeToggle` reflects `ThemeService` state and forwards activations to
 * it — this shell owns no theme logic.
 *
 * Culture switching is composed here the same way: the shell-owned dumb
 * `StorefrontCultureSwitch` reflects `CultureService` state and forwards
 * selections to it. Quick-access links (Cart) and feature destinations
 * (Catalog) dock here as plain routes — only routes that exist, never
 * dead links.
 *
 * SSR/hydration safe: local toggle signal only, no browser APIs. RTL safe:
 * logical properties and direction-aware flex flow only.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthNav } from '@flux/auth';
import { CultureService, SUPPORTED_CULTURE_METADATA } from '@flux/i18n';
import { ThemeService } from '@flux/theming';
import { Container, ThemeToggle } from '@flux/ui';
import { StorefrontCultureSwitch } from '../culture-switch/culture-switch';
import { StorefrontNav, type StorefrontNavItem } from '../navigation/navigation';
import { CART_NAV_ITEM, MAIN_NAV_ITEMS } from '../../storefront-navigation';
import {
  LAYOUT_TRANSLATION_KEYS,
  translateLayoutKey,
} from '../layout-translations/layout-translations';

@Component({
  selector: 'storefront-header',
  imports: [RouterLink, StorefrontNav, StorefrontCultureSwitch, AuthNav, Container, ThemeToggle],
  templateUrl: './header.html',
  styleUrl: './header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StorefrontHeader {
  /**
   * Main destinations with localized labels for the active culture
   * (routes stay app-composed; labels resolve through the layout
   * bundle — never hardcoded, never duplicated).
   */
  protected readonly mainNav = computed(() =>
    MAIN_NAV_ITEMS.map((item): StorefrontNavItem => ({
      label: translateLayoutKey(this.cultures.culture(), item.labelKey),
      route: item.route,
    })),
  );

  /** Localized quick-access cart destination. */
  protected readonly cartNav = computed((): StorefrontNavItem => ({
    label: translateLayoutKey(this.cultures.culture(), CART_NAV_ITEM.labelKey),
    route: CART_NAV_ITEM.route,
  }));

  /** Localized shell chrome for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      brandLabel: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.brandLabel),
      menuLabel: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.menuLabel),
      switchLabel: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.switchLabel),
      navLabel: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.navMainLabel),
      authChecking: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.authChecking),
      authNavLabel: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.authNavLabel),
      authLogin: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.authLogin),
      authRegister: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.authRegister),
      authAccount: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.authAccount),
      authLogout: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.authLogout),
      authLoggingOut: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.authLoggingOut),
    };
  });

  /** Supported cultures offered by the language picker (single source of truth). */
  protected readonly languages = SUPPORTED_CULTURE_METADATA;

  /** Central culture state (read-only here; switched through the picker). */
  protected readonly cultures = inject(CultureService);

  /** Central theme state (read-only here; toggled through the shared control). */
  protected readonly themes = inject(ThemeService);

  /** Mobile menu visibility (local UI state; closed on server and client). */
  readonly menuOpen = signal(false);

  private readonly menuToggle = viewChild<ElementRef<HTMLButtonElement>>('menuToggle');

  /** Toggles the mobile navigation panel. */
  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  /** Closes the mobile panel, returning focus to the toggle (Escape path). */
  closeMenu(): void {
    this.menuOpen.set(false);
    this.menuToggle()?.nativeElement.focus();
  }

  /** Dismisses the mobile panel from anywhere (browser-only event; inert on the server). */
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.menuOpen()) {
      this.closeMenu();
    }
  }
}
