/**
 * Admin inventory adjustments page for Sub-Phase 13.10 — Reservations &
 * Inventory Adjustments.
 *
 * Smart page (route-level composition) within the inventory context
 * (`/inventory/adjustments`): owns the additive adjustment form
 * (`PATCH /inventory/{sku}`), its confirmation dialog, and the updated
 * stock result — over the route-provided `InventoryAdminApiService`
 * transport seam (no feature state: submission locks and the result
 * record are page-local signals, the smallest appropriate scope).
 *
 * Adjustment contract (13.1 audit — only backend-exposed operations):
 * the call is additive ONLY (`{ quantity: 1..max }` — consumption
 * happens via reservation commit, manual decrements do not exist);
 * there is no reason field, no product/variant picker beyond the SKU
 * text (no lookup-by-SKU endpoint exists to back one), and no totals
 * math anywhere. Client validation covers presence plus positive
 * whole-number shape; the documented range, SKU rules, and existence
 * stay backend-owned and surface through the form channels (`400`
 * field maps project onto their controls, `404`/`409` render as the
 * form-level notice with user input preserved). A `404` additionally
 * names the missing SKU and links to item creation (`/inventory/new`
 * prefilled via `?sku=`) — variant creation never provisions stock, so
 * an untracked SKU is a missing record, not a typo.
 *
 * Expected flow (phase contract, honored end to end): form → dialog
 * confirmation → API → backend validation and business logic → the
 * UPDATED inventory state arrives in the `PATCH` response itself and
 * renders as the result — Angular calculates nothing. Re-entrant
 * submits while an adjustment is in flight are no-ops (submit lock
 * plus dialog dismissal on confirm).
 *
 * SSR/hydration safe: signals plus markup, no browser APIs. RTL safe:
 * logical properties only.
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CultureService, resolveApiErrorMessage } from '@flux/i18n';
import { Card, ErrorState } from '@flux/ui';
import { isApiError } from '@flux/api';
import { ADMIN_SERVER_ERROR_KEY } from '../../../../shared/forms/field-errors/field-errors';
import { AdminDialog } from '../../../../shared/dialog/dialog';
import { AdminTextInput } from '../../../../shared/forms/text-input/text-input';
import { InventoryAdminApiService } from '../../data-access/inventory-admin-api.service';
import { AdminNotificationService } from '../../../../shared/notifications/notification-service';
import {
  normalizeSkuInput,
  toAdjustStockRequest,
  type AdminStockRow,
} from '../../models/inventory-admin.models';
import { toFormErrorPath } from '../../../catalog/models/catalog-admin.models';
import {
  INVENTORY_TRANSLATION_KEYS,
  translateInventoryKey,
} from '../../i18n/inventory-translations';

@Component({
  selector: 'app-adjustments-page',
  imports: [ReactiveFormsModule, RouterLink, AdminDialog, AdminTextInput, Card, ErrorState],
  templateUrl: './adjustments-page.html',
  styleUrl: './adjustments-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdjustmentsPage {
  private readonly inventoryApi = inject(InventoryAdminApiService);
  private readonly cultures = inject(CultureService);
  private readonly notifications = inject(AdminNotificationService);

  /** SKU editor control (presence validated; normalization is transport hygiene). */
  protected readonly skuControl = new FormControl<string | null>(null, {
    validators: [Validators.required],
  });

  /**
   * Quantity editor control (presence plus positive whole-number shape;
   * the documented range stays backend-owned).
   */
  protected readonly quantityControl = new FormControl<string | null>(null, {
    validators: [Validators.required, Validators.pattern(/^[1-9]\d*$/)],
  });

  /** Adjustment form group (owns the `ngSubmit` output the template binds). */
  protected readonly form = new FormGroup({
    sku: this.skuControl,
    quantity: this.quantityControl,
  });

  /** Submission in flight (actions lock, duplicate submits no-op). */
  protected readonly submitting = signal(false);

  /** Confirmation dialog open (feature-owned). */
  protected readonly confirmOpen = signal(false);

  /**
   * Confirmed summary snapshot behind the dialog message. Form control
   * values are not signals, so the message cannot derive them through
   * the culture-bound copy — it snapshots them at submit time instead
   * (stale message otherwise: the copy would never re-evaluate).
   */
  protected readonly confirmSummary = signal<{ quantity: string; sku: string } | null>(null);

  /** Form-level failure notice (`null` when clean). */
  protected readonly formError = signal<string | null>(null);

  /**
   * Normalized SKU behind a `404` adjustment failure (`null` otherwise).
   * A missing record is actionable — the template links it to item
   * creation prefilled via `?sku=`.
   */
  protected readonly missingSku = signal<string | null>(null);

  /** Updated stock record from the last successful adjustment (`null` until then). */
  protected readonly result = signal<AdminStockRow | null>(null);

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      heading: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.adjustmentsHeading),
      subheading: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.adjustmentsSubheading),
      skuLabel: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.adjustmentsSkuLabel),
      skuPlaceholder: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.adjustmentsSkuPlaceholder,
      ),
      skuClear: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.adjustmentsSkuClear),
      quantityLabel: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.adjustmentsQuantityLabel,
      ),
      quantityHint: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.adjustmentsQuantityHint,
      ),
      submit: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.adjustmentsSubmit),
      saving: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.adjustmentsSaving),
      confirmTitle: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.adjustmentsConfirmTitle,
      ),
      confirmMessage: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.adjustmentsConfirmMessage,
        {
          quantity: this.confirmSummary()?.quantity ?? '',
          sku: this.confirmSummary()?.sku ?? '',
        },
      ),
      confirm: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.adjustmentsConfirm),
      cancel: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.adjustmentsCancel),
      createItemLink: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.adjustmentsCreateItemLink,
      ),
      formErrorTitle: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.adjustmentsFormErrorTitle,
      ),
      resultTitle: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.adjustmentsResultTitle,
      ),
      factSku: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockFactSku),
      factOnHand: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockFactOnHand),
      factReserved: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockFactReserved),
      factAvailable: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockFactAvailable),
      factUpdated: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockFactUpdated),
    };
  });

  /**
   * Opens the confirmation dialog for a valid form, snapshotting the
   * summary first (see `confirmSummary`). Invalid submits only mark
   * fields; the dialog opens for validated input alone.
   */
  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) {
      return;
    }
    this.confirmSummary.set({
      quantity: (this.quantityControl.value ?? '').trim(),
      sku: normalizeSkuInput(this.skuControl.value),
    });
    this.confirmOpen.set(true);
  }

  /** Closes the confirmation dialog without acting. */
  protected cancelConfirm(): void {
    this.confirmOpen.set(false);
    this.confirmSummary.set(null);
  }

  /**
   * Confirms the adjustment: closes the dialog first (duplicate clicks
   * cannot re-enter), then runs the backend call under the submit lock.
   * Success notifies and renders the backend-returned updated record;
   * failures project `400` field maps onto their controls and render
   * everything else as the form-level notice with user input preserved.
   */
  protected confirmAdjust(): void {
    this.confirmOpen.set(false);
    if (this.submitting()) {
      return;
    }
    const sku = normalizeSkuInput(this.skuControl.value);
    const body = toAdjustStockRequest(this.quantityControl.value);
    if (sku === '') {
      return;
    }
    this.submitting.set(true);
    this.formError.set(null);
    this.missingSku.set(null);
    this.clearServerErrors();
    this.inventoryApi.adjustStock(sku, body).subscribe({
      next: (envelope) => {
        this.submitting.set(false);
        const record = envelope.data ?? null;
        if (record === null) {
          this.failGeneric();
          return;
        }
        this.result.set(record);
        const culture = this.cultures.culture();
        this.notifications.success(
          translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.adjustmentsSuccessTitle),
          translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.adjustmentsSuccessMessage, {
            sku: record.sku,
          }),
        );
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  private fail(error: unknown): void {
    this.submitting.set(false);
    if (isApiError(error) && error.status === 400 && error.validationErrors !== undefined) {
      const unknown = this.applyServerErrors(error.validationErrors);
      if (unknown.length === 0) {
        return;
      }
    }
    if (isApiError(error) && error.status === 404) {
      this.failMissing();
      return;
    }
    this.missingSku.set(null);
    const culture = this.cultures.culture();
    this.formError.set(
      isApiError(error)
        ? resolveApiErrorMessage(error, culture)
        : translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.adjustmentsFormErrorTitle),
    );
  }

  /**
   * Handles the missing-record failure: names the untracked SKU and
   * exposes the creation link (user input stays preserved in the form).
   */
  private failMissing(): void {
    const sku = normalizeSkuInput(this.skuControl.value);
    this.missingSku.set(sku === '' ? null : sku);
    const culture = this.cultures.culture();
    this.formError.set(
      translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.adjustmentsMissingItem, { sku }),
    );
  }

  private failGeneric(): void {
    this.submitting.set(false);
    this.formError.set(
      translateInventoryKey(
        this.cultures.culture(),
        INVENTORY_TRANSLATION_KEYS.adjustmentsFormErrorTitle,
      ),
    );
  }

  private applyServerErrors(errors: Record<string, string[]>): string[] {
    const unknown: string[] = [];
    for (const [key, messages] of Object.entries(errors)) {
      const control = this.form.get(toFormErrorPath(key));
      if (control === null) {
        unknown.push(key);
      } else {
        control.setErrors({ ...(control.errors ?? {}), [ADMIN_SERVER_ERROR_KEY]: messages });
        control.markAsTouched();
      }
    }
    return unknown;
  }

  private clearServerErrors(): void {
    for (const path of ['sku', 'quantity']) {
      const control = this.form.get(path);
      if (control !== null && control.errors !== null && ADMIN_SERVER_ERROR_KEY in control.errors) {
        const { [ADMIN_SERVER_ERROR_KEY]: _dropped, ...rest } = control.errors;
        control.setErrors(Object.keys(rest).length === 0 ? null : rest);
      }
    }
  }
}
