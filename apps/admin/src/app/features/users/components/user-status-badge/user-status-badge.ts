/**
 * Admin user status badge for Supplement S1, Step S1.5 — Admin Users &
 * Permissions.
 *
 * Feature-owned presentational component: renders HOW one backend user
 * status reads — the shared `flux-badge` primitive with a localized
 * label. Dumb by design — the owning view decides WHEN and WHAT (the
 * status arrives as a plain input, backend number verbatim). No API
 * access, no HTTP, no state writes — presentational components never
 * call backend APIs (`ARCHITECTURE.md` §8).
 *
 * Backend-authoritative rules (S1.1 audit — the core constraint):
 * - The label localizes the KNOWN backend values (`UserStatus` numbers
 *   `0..4`); unknown or future backend values render VERBATIM with the
 *   `neutral` tone (forward compatibility, `ENUM_REFERENCE.md` §8) —
 *   never mapped, never dropped.
 * - Status → display mapping lives in exactly one place
 *   (`userStatusDisplay` in `../../models/users-admin.models`) — no
 *   scattered numeric comparisons anywhere.
 *
 * Accessibility: the status ALWAYS renders as text (never color-only).
 *
 * SSR/hydration safe: static markup from input + culture only, no
 * browser APIs. RTL safe: logical properties only, no direction
 * branching.
 */

import { ChangeDetectionStrategy, Component, inject, Input } from '@angular/core';
import { CultureService } from '@flux/i18n';
import { Badge, type BadgeVariant } from '@flux/ui';
import { userStatusDisplay } from '../../models/users-admin.models';
import { USERS_TRANSLATION_KEYS, translateUsersKey } from '../../i18n/users-translations';

@Component({
  selector: 'app-user-status-badge',
  imports: [Badge],
  templateUrl: './user-status-badge.html',
  styleUrl: './user-status-badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserStatusBadge {
  /** Backend user status value to present (verbatim source of truth). */
  @Input({ required: true }) status!: number;

  private readonly cultures = inject(CultureService);

  /** Presentation variant for the status (`neutral` for unknown values). */
  protected variant(): BadgeVariant {
    return userStatusDisplay(this.status).variant;
  }

  /** Localized label, or the raw backend value for unknown statuses. */
  protected label(): string {
    const culture = this.cultures.culture();
    const display = userStatusDisplay(this.status);
    if (display.labelKey === USERS_TRANSLATION_KEYS.statusUnknown) {
      return String(this.status);
    }
    return translateUsersKey(culture, display.labelKey);
  }
}
