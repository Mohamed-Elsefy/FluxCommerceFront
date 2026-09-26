/**
 * Admin notification host for Sub-Phase 12.7 — Dialogs & Notifications.
 *
 * Presentation only: renders the central `AdminNotificationService`
 * state as stacked toasts/alerts in a live corner of the viewport.
 * Success/info toasts announce politely (`role="status"`), warning/
 * error alerts assertively (`role="alert"`); every item carries a
 * dismiss action. Dumb by design — copy, timing, and dismissal policy
 * stay with raisers and this host's `dismissLabel` owner.
 *
 * SSR/hydration safe: signals plus static markup, no browser APIs.
 * RTL safe: logical inset positioning, no direction branching.
 */

import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { AdminNotificationService, type AdminNotificationType } from '../notification-service';

@Component({
  selector: 'admin-notification-host',
  templateUrl: './notification-host.html',
  styleUrl: './notification-host.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminNotificationHost {
  /** Central notification state (read-only here; raised by features). */
  protected readonly center = inject(AdminNotificationService);

  /** Accessible landmark name (owner-localized). */
  @Input() label = 'Notifications';
  /** Dismiss action text (owner-localized). */
  @Input() dismissLabel = 'Dismiss';

  /** Polite announcements for neutral intents, assertive for problems. */
  protected roleFor(type: AdminNotificationType): 'status' | 'alert' {
    return type === 'warning' || type === 'error' ? 'alert' : 'status';
  }
}
