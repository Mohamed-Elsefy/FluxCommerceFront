/**
 * Admin field-error presentation for Sub-Phase 12.6 — Filtering & Form
 * Primitives.
 *
 * Presentational only: renders the validation messages of one form
 * control. Messages appear once the control is touched or dirty.
 * Client-side messages resolve through the Phase 4 platform resolver
 * (`resolveValidationMessage` over `common.validation.*`) for the
 * active culture; backend `server` messages (string arrays applied by
 * owning features) pass through verbatim (backend-localized).
 */

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  inject,
} from '@angular/core';
import { AbstractControl, ValidationErrors } from '@angular/forms';
import type { Subscription } from 'rxjs';
import { CultureService, resolveValidationMessage } from '@flux/i18n';

/** Control error key carrying backend field messages (string array). */
export const ADMIN_SERVER_ERROR_KEY = 'server';

@Component({
  selector: 'admin-field-errors',
  templateUrl: './field-errors.html',
  styleUrl: './field-errors.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminFieldErrors implements OnChanges, OnDestroy {
  /** Control whose errors render; null renders nothing. */
  @Input() control: AbstractControl | null = null;

  private readonly cultures = inject(CultureService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private controlEvents: Subscription | null = null;

  /**
   * Refreshes on every control event (value, status, touched, pristine,
   * disable): `AbstractControl` mutations do not touch @Inputs, so an
   * `OnPush` view would otherwise stay stale until an unrelated check
   * (e.g. `markAllAsTouched()` on submit would never paint).
   */
  ngOnChanges(): void {
    this.controlEvents?.unsubscribe();
    this.controlEvents =
      this.control?.events.subscribe(() => this.changeDetector.markForCheck()) ?? null;
  }

  ngOnDestroy(): void {
    this.controlEvents?.unsubscribe();
  }

  shouldShow(): boolean {
    const control = this.control;
    return (
      control !== null &&
      control.invalid &&
      (control.touched || control.dirty) &&
      !control.disabled &&
      this.messages().length > 0
    );
  }

  messages(): string[] {
    const control = this.control;
    if (control === null || control.errors === null) {
      return [];
    }
    const messages: string[] = [];
    const { [ADMIN_SERVER_ERROR_KEY]: _server, ...clientErrors } = control.errors;
    const localized = resolveValidationMessage(
      clientErrors as ValidationErrors,
      this.cultures.culture(),
    );
    if (localized !== null) {
      messages.push(localized);
    }
    const server = control.errors[ADMIN_SERVER_ERROR_KEY];
    if (Array.isArray(server)) {
      for (const message of server) {
        if (typeof message === 'string') {
          messages.push(message);
        }
      }
    }
    return messages;
  }
}
