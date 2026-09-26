/**
 * Admin header for Sub-Phases 3.7 + 12.3 — Admin Application Shell.
 *
 * Composition only: mobile menu toggle (emitted to the parent shell, which
 * owns drawer state), application context title, language picker, and the
 * Phase 2 `AuthNav` for the authenticated admin user area (login/
 * registration links hidden — this portal has no such routes; the account
 * entry points at the dashboard). No auth logic lives here — `AuthService`
 * signals stay inside `AuthNav`.
 *
 * Theme switching is composed here (Sub-Phase 3.10): the shared dumb
 * `ThemeToggle` reflects `ThemeService` state and forwards activations to
 * it — this shell owns no theme logic. Culture switching is composed the
 * same way: the shell-owned dumb `AdminCultureSwitch` reflects
 * `CultureService` state and forwards selections to it. All chrome copy
 * resolves through the admin layout bundle for the active culture.
 *
 * SSR/hydration safe: static markup plus an output emission, no browser
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
import { CultureService, SUPPORTED_CULTURE_METADATA, type Culture } from '@flux/i18n';
import { ThemeService } from '@flux/theming';
import { ThemeToggle } from '@flux/ui';
import { AdminCultureSwitch } from '../culture-switch/culture-switch';
import {
  ADMIN_LAYOUT_TRANSLATION_KEYS,
  translateAdminLayoutKey,
} from '../layout-translations/layout-translations';

@Component({
  selector: 'admin-header',
  imports: [AuthNav, ThemeToggle, AdminCultureSwitch],
  templateUrl: './header.html',
  styleUrl: './header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminHeader {
  /** Central theme state (read-only here; toggled through the shared control). */
  protected readonly themes = inject(ThemeService);

  /** Central culture state (read-only here; switched through the picker). */
  protected readonly cultures = inject(CultureService);

  /** Supported cultures offered by the language picker (single source of truth). */
  protected readonly languages = SUPPORTED_CULTURE_METADATA;

  /** Localized shell chrome for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      context: translateAdminLayoutKey(culture, ADMIN_LAYOUT_TRANSLATION_KEYS.headerContext),
      menuLabel: translateAdminLayoutKey(culture, ADMIN_LAYOUT_TRANSLATION_KEYS.headerMenuLabel),
      switchLabel: translateAdminLayoutKey(culture, ADMIN_LAYOUT_TRANSLATION_KEYS.switchLabel),
      authChecking: translateAdminLayoutKey(culture, ADMIN_LAYOUT_TRANSLATION_KEYS.authChecking),
      authNavLabel: translateAdminLayoutKey(culture, ADMIN_LAYOUT_TRANSLATION_KEYS.authNavLabel),
      authLogin: translateAdminLayoutKey(culture, ADMIN_LAYOUT_TRANSLATION_KEYS.authLogin),
      authRegister: translateAdminLayoutKey(culture, ADMIN_LAYOUT_TRANSLATION_KEYS.authRegister),
      authAccount: translateAdminLayoutKey(culture, ADMIN_LAYOUT_TRANSLATION_KEYS.authAccount),
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

  /** Applies a validated language-picker selection to the central culture state. */
  protected onCultureChange(culture: Culture): void {
    this.cultures.setCulture(culture);
  }

  /** Returns keyboard focus to the drawer toggle (Escape path). */
  focusToggle(): void {
    this.toggle()?.nativeElement.focus();
  }
}
