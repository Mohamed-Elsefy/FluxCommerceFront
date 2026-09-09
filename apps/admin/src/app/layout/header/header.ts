/**
 * Admin header for Sub-Phase 3.7 — Admin Application Shell.
 *
 * Composition only: mobile menu toggle (emitted to the parent shell, which
 * owns drawer state), application context title, and the Phase 2 `AuthNav`
 * for the authenticated admin user area (login/registration links hidden —
 * this portal has no such routes; the account entry points at the
 * dashboard). No auth logic lives here — `AuthService` signals stay inside
 * `AuthNav`.
 *
 * Theme switching UI arrives with Sub-Phase 3.10 (`ThemeToggle`); the
 * header already renders under the centralized theme via tokens.
 *
 * SSR/hydration safe: static markup plus an output emission, no browser
 * APIs. RTL safe: logical properties and direction-aware flex flow only.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import { AuthNav } from '@flux/auth';

@Component({
  selector: 'admin-header',
  imports: [AuthNav],
  templateUrl: './header.html',
  styleUrl: './header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminHeader {
  /** Emitted when the mobile drawer toggle is activated (parent shell owns the drawer). */
  @Output() readonly menuToggle = new EventEmitter<void>();
}
