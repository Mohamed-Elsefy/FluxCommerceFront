/**
 * Admin header — Kinetic glass bar mirroring the storefront arrangement.
 *
 * Composition only: mobile menu toggle (emitted to the parent shell, which
 * owns drawer state), a mobile-only brand mark (the sidebar carries the
 * brand on desktop), and an actions group — language-cycle pill, theme
 * toggle, and the Phase 2 `AuthNav` (login/registration/account links
 * hidden: this portal has no such routes; authenticated operators see
 * their identity plus logout). No auth logic lives here — `AuthService`
 * signals stay inside `AuthNav`.
 *
 * Theme switching is composed here (Sub-Phase 3.10): the shared dumb
 * `ThemeToggle` reflects `ThemeService` state and forwards activations to
 * it — this shell owns no theme logic. Culture switching mirrors the
 * storefront cycle pill: each press steps to the next supported culture.
 * All chrome copy resolves through the admin layout bundle for the
 * active culture.
 *
 * SSR/hydration safe: static markup plus output emissions, no browser
 * APIs. RTL safe: logical properties and direction-aware flex flow only.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  inject,
  viewChild,
} from '@angular/core';
import { AuthNav } from '@flux/auth';
import { CultureService, SUPPORTED_CULTURE_METADATA } from '@flux/i18n';
import { ThemeService } from '@flux/theming';
import { ThemeToggle } from '@flux/ui';
import {
  ADMIN_LAYOUT_TRANSLATION_KEYS,
  translateAdminLayoutKey,
} from '../layout-translations/layout-translations';

@Component({
  selector: 'admin-header',
  imports: [AuthNav, ThemeToggle],
  templateUrl: './header.html',
  styleUrl: './header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminHeader {
  /** Central theme state (read-only here; toggled through the shared control). */
  protected readonly themes = inject(ThemeService);

  /** Central culture state (read-only here; stepped through the pill). */
  protected readonly cultures = inject(CultureService);

  /** Supported cultures in cycle order (single source of truth). */
  protected readonly languages = SUPPORTED_CULTURE_METADATA;

  /** Current culture display name shown on the cycle pill. */
  protected readonly currentLanguage = computed(() => {
    const culture = this.cultures.culture();
    return this.languages.find((item) => item.code === culture)?.displayName ?? culture;
  });

  /** Localized shell chrome for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      menuLabel: translateAdminLayoutKey(culture, ADMIN_LAYOUT_TRANSLATION_KEYS.headerMenuLabel),
      authChecking: translateAdminLayoutKey(culture, ADMIN_LAYOUT_TRANSLATION_KEYS.authChecking),
      authNavLabel: translateAdminLayoutKey(culture, ADMIN_LAYOUT_TRANSLATION_KEYS.authNavLabel),
      authLogin: translateAdminLayoutKey(culture, ADMIN_LAYOUT_TRANSLATION_KEYS.authLogin),
      authRegister: translateAdminLayoutKey(culture, ADMIN_LAYOUT_TRANSLATION_KEYS.authRegister),
      authLogout: translateAdminLayoutKey(culture, ADMIN_LAYOUT_TRANSLATION_KEYS.authLogout),
      authLoggingOut: translateAdminLayoutKey(
        culture,
        ADMIN_LAYOUT_TRANSLATION_KEYS.authLoggingOut,
      ),
    };
  });

  /** Drawer visibility owned by the parent shell (mirrored for `aria-expanded`). */
  @Input() drawerOpen = false;

  /** Emitted when the mobile drawer toggle is activated (parent shell owns the drawer). */
  @Output() readonly menuToggle = new EventEmitter<void>();

  private readonly toggle = viewChild<ElementRef<HTMLButtonElement>>('toggle');

  /** Steps to the next supported culture (wraps around). */
  cycleCulture(): void {
    const codes = this.languages.map((item) => item.code);
    const next = codes[(codes.indexOf(this.cultures.culture()) + 1) % codes.length];
    this.cultures.setCulture(next);
  }

  /** Returns keyboard focus to the drawer toggle (Escape path). */
  focusToggle(): void {
    this.toggle()?.nativeElement.focus();
  }
}
