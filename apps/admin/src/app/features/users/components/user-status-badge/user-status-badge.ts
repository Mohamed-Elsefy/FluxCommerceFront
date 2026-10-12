/**
 * Admin user status badge for Supplement S1, Step S1.5 — Admin Users &
 * Permissions.
 *
 * Thin feature adapter over the shared `StatusBadge` (Refactoring
 * Phase B): the status → display map stays in exactly one place
 * (`userStatusDisplay` in `../../models/users-admin.models`) and labels
 * resolve through the users bundle — the rendering logic
 * (variant/label resolution, verbatim unknown fallback) lives in the
 * shared component. Dumb by design — the owning view decides WHEN and
 * WHAT (the status arrives as a plain input, backend number verbatim).
 * No API access, no HTTP, no state writes.
 *
 * Backend-authoritative rules (S1.1 audit — the core constraint):
 * - The label localizes the KNOWN backend values (`UserStatus` numbers
 *   `0..4`); unknown or future backend values render VERBATIM with the
 *   `neutral` tone (forward compatibility, `ENUM_REFERENCE.md` §8) —
 *   never mapped, never dropped.
 *
 * Accessibility: the status ALWAYS renders as text (never color-only).
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { StatusBadge } from '../../../../shared/status-badge/status-badge';
import { userStatusDisplay } from '../../models/users-admin.models';
import { USERS_TRANSLATION_KEYS, translateUsersKey } from '../../i18n/users-translations';

@Component({
  selector: 'app-user-status-badge',
  imports: [StatusBadge],
  templateUrl: './user-status-badge.html',
  styleUrl: './user-status-badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserStatusBadge {
  /** Backend user status value to present (verbatim source of truth). */
  @Input({ required: true }) status!: number;

  /** Single mapping site for admin user status. */
  protected readonly displayOf = userStatusDisplay;

  /** Unknown-entry key branching to the verbatim fallback. */
  protected readonly unknownLabelKey = USERS_TRANSLATION_KEYS.statusUnknown;

  /** Users-bundle key resolver. */
  protected readonly translateKey = translateUsersKey;
}
