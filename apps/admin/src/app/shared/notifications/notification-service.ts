/**
 * Admin notification service for Sub-Phase 12.7 — Dialogs & Notifications.
 *
 * Central toast/alert state for the portal:
 *
 * ```text
 * NotificationService (this file — sole writer)
 *         ↓ notifications (readonly signal)
 * Notification Host (renders + dismisses)
 *         ↓ Toast / Alert
 * ```
 *
 * Types mirror intent (`success`/`info`/`warning`/`error`); copy stays
 * owner-localized at the call site — this service never invents text
 * and never couples to business domains (orders, products, payments,
 * inventory). Dismissal is explicit (`dismiss`/`clear`): no timers, so
 * no hidden async behavior and no fakeAsync in specs. Features that
 * want auto-expiry own their own timers around these primitives.
 */

import { Injectable, Signal, signal } from '@angular/core';

/** Notification intent (drives host role and tint). */
export type AdminNotificationType = 'success' | 'info' | 'warning' | 'error';

/** Single notification (immutable snapshot). */
export interface AdminNotification {
  /** Deterministic per-service id (counter, never random). */
  readonly id: number;
  readonly type: AdminNotificationType;
  /** Heading (owner-localized). */
  readonly title: string;
  /** Body copy (owner-localized). */
  readonly message: string;
}

/** Input for raising a notification (id assigned by the service). */
export interface AdminNotificationInput {
  readonly type: AdminNotificationType;
  readonly title: string;
  readonly message: string;
}

/**
 * The single typed gateway to notification state. Inject this — never
 * replicate notification signals — in features and the host.
 */
@Injectable({ providedIn: 'root' })
export class AdminNotificationService {
  private readonly _notifications = signal<readonly AdminNotification[]>([]);
  private nextId = 1;

  /** Live notifications, oldest first. */
  readonly notifications: Signal<readonly AdminNotification[]> = this._notifications.asReadonly();

  /** Raises a notification, returning its id. */
  show(input: AdminNotificationInput): number {
    const id = this.nextId++;
    this._notifications.update((current) => [...current, { ...input, id }]);
    return id;
  }

  /** Convenience raiser for success toasts. */
  success(title: string, message: string): number {
    return this.show({ type: 'success', title, message });
  }

  /** Convenience raiser for info toasts. */
  info(title: string, message: string): number {
    return this.show({ type: 'info', title, message });
  }

  /** Convenience raiser for warning alerts. */
  warning(title: string, message: string): number {
    return this.show({ type: 'warning', title, message });
  }

  /** Convenience raiser for error alerts. */
  error(title: string, message: string): number {
    return this.show({ type: 'error', title, message });
  }

  /** Removes one notification (no-op for unknown ids). */
  dismiss(id: number): void {
    this._notifications.update((current) => current.filter((item) => item.id !== id));
  }

  /** Removes every notification. */
  clear(): void {
    this._notifications.set([]);
  }
}
