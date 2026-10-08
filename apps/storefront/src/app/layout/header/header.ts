/**
 * Storefront header — Kinetic glass bar (DESIGN §6.4).
 *
 * Composition only: brand wordmark, segmented main nav (Home / Products /
 * Cart / Orders), pill search (navigates to the `/products` shelf), a
 * language-cycle pill (steps to the next supported culture), the theme
 * toggle, and the account entry — anonymous sees a single Primary login
 * pill (registration lives on the login page), authenticated sees an
 * avatar circle linking straight to the profile (account actions live
 * there, including logout).
 *
 * Auth state reads central `AuthService` signals (never replicated);
 * culture writes go through `CultureService`. SSR/hydration safe: local
 * toggle signals only, no browser APIs. RTL safe: logical properties and
 * direction-aware flex flow only.
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
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@flux/auth';
import { CultureService, SUPPORTED_CULTURE_METADATA } from '@flux/i18n';
import { ThemeService } from '@flux/theming';
import { Container, ThemeToggle } from '@flux/ui';
import { StorefrontNav, type StorefrontNavItem } from '../navigation/navigation';
import { MAIN_NAV_ITEMS } from '../../storefront-navigation';
import {
  LAYOUT_TRANSLATION_KEYS,
  translateLayoutKey,
} from '../layout-translations/layout-translations';

@Component({
  selector: 'storefront-header',
  imports: [RouterLink, FormsModule, StorefrontNav, ThemeToggle, Container],
  templateUrl: './header.html',
  styleUrl: './header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StorefrontHeader {
  /**
   * Main destinations with localized labels for the active culture.
   * Authenticated-only entries stay hidden from anonymous visitors
   * (they reach those areas through the login pill + guard return).
   */
  protected readonly mainNav = computed(() => {
    const authenticated = this.auth.isAuthenticated();
    return MAIN_NAV_ITEMS.filter((item) => !item.authenticatedOnly || authenticated).map(
      (item): StorefrontNavItem => ({
        label: translateLayoutKey(this.cultures.culture(), item.labelKey),
        route: item.route,
      }),
    );
  });

  /** Localized shell chrome for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      brandLabel: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.brandLabel),
      menuLabel: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.menuLabel),
      searchLabel: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.searchLabel),
      searchPlaceholder: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.searchPlaceholder),
      searchButton: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.searchButton),
      switchLabel: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.switchLabel),
      navLabel: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.navMainLabel),
      authLogin: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.authLogin),
      authAccount: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.authAccount),
    };
  });

  /** Supported cultures in cycle order (single source of truth). */
  protected readonly languages = SUPPORTED_CULTURE_METADATA;

  /** Current culture display name shown on the cycle pill. */
  protected readonly currentLanguage = computed(() => {
    const culture = this.cultures.culture();
    return this.languages.find((item) => item.code === culture)?.displayName ?? culture;
  });

  /** Central culture state (read-only here; stepped through the pill). */
  protected readonly cultures = inject(CultureService);

  /** Central theme state (read-only here; toggled through the shared control). */
  protected readonly themes = inject(ThemeService);

  /** Central authentication state (read-only here; entry point only). */
  protected readonly auth = inject(AuthService);

  private readonly router = inject(Router);

  /** Header search text (local UI state; committed to `/products` on submit). */
  protected readonly searchText = signal('');

  /** Mobile menu visibility (local UI state; closed on server and client). */
  readonly menuOpen = signal(false);

  /** Avatar initial (first letter of the display name or email, fallback `•`). */
  protected readonly avatarInitial = computed(() => {
    const user = this.auth.currentUser();
    const name = user?.displayName ?? user?.email ?? '';
    const first = name.trim().charAt(0);
    return first !== '' ? first.toUpperCase() : '•';
  });

  private readonly menuToggle = viewChild<ElementRef<HTMLButtonElement>>('menuToggle');

  /** Submits the header search to the products shelf. */
  submitSearch(): void {
    const searchTerm = this.searchText().trim();
    this.closeMenu();
    void this.router.navigate(['/products'], {
      queryParams: searchTerm !== '' ? { searchTerm } : {},
    });
  }

  /** Steps to the next supported culture (wraps around). */
  cycleCulture(): void {
    const codes = this.languages.map((item) => item.code);
    const next = codes[(codes.indexOf(this.cultures.culture()) + 1) % codes.length];
    this.cultures.setCulture(next);
  }

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
