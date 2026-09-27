/**
 * Admin reservation lookup page for Sub-Phase 13.10 — Reservations &
 * Inventory Adjustments.
 *
 * Smart page (route-level composition) within the inventory context
 * (`/inventory/reservations`): reads the feature-scoped
 * `ReservationState` (route-provided `inventoryRoutes` entry — never a
 * global store) and renders one reservation lookup at a time through
 * the shared async UI.
 *
 * Display contract (13.1 audit — only backend-exposed capabilities):
 * `GET /inventory/reservations/{id}` is the single reservation read —
 * ids are never enumerable, so there is no reservation list, no
 * pagination, no filtering, and no search UI here by design. The record
 * renders the backend-issued fields verbatim (reservation and order
 * ids, SKU, quantity, status, and timestamps); the status names itself
 * through `reservationStatusDisplay` with the forward-compatible
 * unknown fallback. The reservation lifecycle (commit, release,
 * expiry) stays entirely backend-owned: this page performs no
 * transitions and gates none.
 *
 * Resource states: idle (entry prompt) → loading → success | error
 * with retry. There is no separate empty state: a single-resource read
 * either returns its record or fails (unknown ids surface as `404`
 * through the error state, never as an empty list). Failures resolve
 * through `resolveApiErrorMessage` (never backend text).
 *
 * SSR/hydration safe: signals plus markup, no browser APIs. RTL safe:
 * logical properties only.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - Reservation listing, filtering, or pagination (no backend contract).
 * - Reservation lifecycle transitions (backend-owned, no endpoint).
 */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CultureService, resolveApiErrorMessage, translateKey } from '@flux/i18n';
import { Badge, type BadgeVariant, Card, EmptyState, ErrorState, LoadingIndicator } from '@flux/ui';
import { AdminSearchInput } from '../../../../shared/filters/search-input/search-input';
import { ReservationState } from '../../state/reservation-state';
import { reservationStatusDisplay } from '../../models/inventory-admin.models';
import {
  INVENTORY_TRANSLATION_KEYS,
  translateInventoryKey,
} from '../../i18n/inventory-translations';

@Component({
  selector: 'app-reservations-page',
  imports: [
    ReactiveFormsModule,
    AdminSearchInput,
    Badge,
    Card,
    EmptyState,
    ErrorState,
    LoadingIndicator,
  ],
  templateUrl: './reservations-page.html',
  styleUrl: './reservations-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservationsPage {
  private readonly reservations = inject(ReservationState);
  private readonly cultures = inject(CultureService);

  /** Reservation id editor control (presence validated; shape rules stay backend-owned). */
  protected readonly idControl = new FormControl<string | null>(null, {
    validators: [Validators.required],
  });

  /** Lookup form group (owns the `ngSubmit` output the template binds). */
  protected readonly form = new FormGroup({ id: this.idControl });

  /** Current reservation record (idle → loading → success | error). */
  protected readonly slot = this.reservations.reservation;

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      heading: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.reservationsHeading),
      subheading: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.reservationsSubheading),
      idLabel: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.reservationsIdLabel),
      idPlaceholder: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.reservationsIdPlaceholder,
      ),
      idClear: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.reservationsIdClear),
      lookup: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.reservationsLookup),
      idleTitle: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.reservationsIdleTitle),
      idleMessage: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.reservationsIdleMessage,
      ),
      loading: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.reservationsLoading),
      errorTitle: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.reservationsErrorTitle),
      retry: translateKey(culture, 'common.actions.retry'),
      factReservation: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.reservationsFactReservation,
      ),
      factOrder: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.reservationsFactOrder),
      factSku: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.reservationsFactSku),
      factQuantity: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.reservationsFactQuantity,
      ),
      factStatus: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.reservationsFactStatus),
      factExpires: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.reservationsFactExpires,
      ),
      factCreated: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.reservationsFactCreated,
      ),
      factUpdated: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.reservationsFactUpdated,
      ),
    };
  });

  /** Status badge (label + variant, unknown-safe). */
  protected readonly statusBadge = computed((): { label: string; variant: BadgeVariant } | null => {
    const status = this.slot().data?.status;
    if (status === undefined || status === null) {
      return null;
    }
    const display = reservationStatusDisplay(status);
    return {
      label: translateInventoryKey(this.cultures.culture(), display.labelKey, {
        value: String(status),
      }),
      variant: display.variant,
    };
  });

  /** Localized failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.slot().error, this.cultures.culture()),
  );

  /**
   * Submits the editor value. Invalid submits only mark the field;
   * duplicate in-flight submits no-op at the state level.
   */
  protected submit(): void {
    this.idControl.markAsTouched();
    if (this.idControl.invalid) {
      return;
    }
    this.reservations.lookup(this.idControl.value);
  }

  /** Lookup retry re-enters the current editor value. */
  protected retry(): void {
    this.reservations.lookup(this.idControl.value);
  }
}
