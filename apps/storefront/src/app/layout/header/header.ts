/**
 * Storefront header — Kinetic glass bar (DESIGN §6.4).
 *
 * Composition only: brand wordmark, segmented main nav (Home / Products /
 * Cart), live pill search (debounced keystrokes commit to the `/products`
 * `/products` shelf like the former in-page search box; Enter submits
 * immediately), a language-cycle pill (steps to the next supported
 * culture), the theme toggle, and the account entry — anonymous sees a
 * single Primary login pill (registration lives on the login page),
 * authenticated sees an avatar circle linking straight to the profile
 * (account actions live there, including logout).
 *
 * Auth state reads central `AuthService` signals (never replicated);
 * culture writes go through `CultureService`. SSR/hydration safe: live
 * search wiring runs browser-only (no navigation during SSR), every other
 * browser-only access is platform-guarded. RTL safe: logical properties
 * and direction-aware flex flow only.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  PLATFORM_ID,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs';
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

/** Quiet period before raw keystrokes become a shelf query. */
export const HEADER_SEARCH_DEBOUNCE_MS = 300;

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
   * Orders live in the account area — never in the header.
   */
  protected readonly mainNav = computed(() =>
    MAIN_NAV_ITEMS.map((item): StorefrontNavItem => ({
      label: translateLayoutKey(this.cultures.culture(), item.labelKey),
      route: item.route,
    })),
  );

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
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Header search text (local UI state; committed live to `/products`). */
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

  /**
   * Backend avatar URL for the account entry (`null` when absent or
   * blank — the entry falls back to the initial circle).
   */
  protected readonly avatarUrl = computed(() => {
    const raw = this.auth.currentUser()?.avatarUrl ?? null;
    return raw !== null && raw.trim() !== '' ? raw : null;
  });

  /** Whether the avatar image proved broken (initial-circle fallback). */
  protected readonly avatarFailed = signal(false);

  private readonly menuToggle = viewChild<ElementRef<HTMLButtonElement>>('menuToggle');

  constructor() {
    // A new avatar URL re-arms the image (a previous broken URL must not
    // pin the fallback for the next one).
    effect(() => {
      this.avatarUrl();
      untracked(() => this.avatarFailed.set(false));
    });
    // Browser only: live search commits debounced keystrokes to the shelf
    // (same funnel as the former in-page box — debounce, dedupe, teardown
    // with the shell) and the box echoes the committed `searchTerm` back
    // on navigation, so back-navigation and cleared searches always show
    // the active query. `replaceUrl` keeps typing bursts out of history.
    // The server renders the empty box and never navigates (SSR-safe).
    if (this.isBrowser) {
      toObservable(this.searchText)
        .pipe(debounceTime(HEADER_SEARCH_DEBOUNCE_MS), distinctUntilChanged(), takeUntilDestroyed())
        .subscribe((search) => this.commitSearch(search));
      this.router.events
        .pipe(
          filter((event): event is NavigationEnd => event instanceof NavigationEnd),
          takeUntilDestroyed(),
        )
        .subscribe(() => this.syncSearchBox());
      this.syncSearchBox();
    }
  }

  /** Commits settled search text to the shelf (page reset by construction). */
  private commitSearch(search: string): void {
    const searchTerm = search.trim();
    void this.router.navigate(['/products'], {
      queryParams: searchTerm !== '' ? { searchTerm } : {},
      replaceUrl: true,
    });
  }

  /** Echoes the committed URL `searchTerm` back into the box (no-op when equal). */
  private syncSearchBox(): void {
    const parsed = this.router.parseUrl(this.router.url).queryParams['searchTerm'];
    const committed = typeof parsed === 'string' ? parsed : '';
    if (committed !== this.searchText()) {
      this.searchText.set(committed);
    }
  }

  /** Submits the header search to the products shelf immediately. */
  submitSearch(): void {
    this.closeMenu();
    this.commitSearch(this.searchText());
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
