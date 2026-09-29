/**
 * Admin inventory item creation page — creates the inventory record for
 * one SKU (`POST /inventory`).
 *
 * Smart page (route-level composition) within the inventory context
 * (`/inventory/new`): owns the creation form and the created stock
 * result — over the route-provided `InventoryAdminApiService` transport
 * seam (no feature state: submission locks and the result record are
 * page-local signals, the smallest appropriate scope).
 *
 * Creation contract (13.1 audit — only backend-exposed operations):
 * variant creation never provisions stock (Catalog and Inventory share
 * no provisioning flow — a `VariantCreated` domain event stays inside
 * the Catalog module), so every new purchasable SKU needs its record
 * created here first: `{ sku, onHandQuantity }` with on-hand admitting
 * zero. Duplicates surface as `409`; SKU shape rules stay
 * backend-owned and surface through the form channels (`400` field maps
 * project onto their controls, everything else renders as the
 * form-level notice). Client validation covers presence, the 64-char
 * SKU limit, and non-negative whole-number shape. No confirmation
 * dialog: creation is not destructive (the adjustments slice confirms
 * because it mutates live stock). Re-entrant submits while creation is
 * in flight are no-ops.
 *
 * The SKU editor prefills from the `?sku=` query parameter when present
 * (the adjustments page links here after a `404` on an untracked SKU),
 * read once from the route snapshot — normalization still runs at
 * submit time.
 *
 * SSR/hydration safe: signals plus markup, no browser APIs. RTL safe:
 * logical properties only.
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CultureService, resolveApiErrorMessage } from '@flux/i18n';
import { Card, ErrorState } from '@flux/ui';
import { isApiError } from '@flux/api';
import { ADMIN_SERVER_ERROR_KEY } from '../../../../shared/forms/field-errors/field-errors';
import { AdminTextInput } from '../../../../shared/forms/text-input/text-input';
import { InventoryAdminApiService } from '../../data-access/inventory-admin-api.service';
import { AdminNotificationService } from '../../../../shared/notifications/notification-service';
import {
  toCreateInventoryItemRequest,
  type AdminStockRow,
} from '../../models/inventory-admin.models';
import { toFormErrorPath } from '../../../catalog/models/catalog-admin.models';
import {
  INVENTORY_TRANSLATION_KEYS,
  translateInventoryKey,
} from '../../i18n/inventory-translations';

@Component({
  selector: 'app-new-item-page',
  imports: [ReactiveFormsModule, RouterLink, AdminTextInput, Card, ErrorState],
  templateUrl: './new-item-page.html',
  styleUrl: './new-item-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewItemPage {
  private readonly inventoryApi = inject(InventoryAdminApiService);
  private readonly cultures = inject(CultureService);
  private readonly notifications = inject(AdminNotificationService);
  private readonly route = inject(ActivatedRoute);

  /**
   * SKU editor control (presence plus the 64-char limit; charset and
   * normalization stay transport/backend-owned). Prefilled from `?sku=`
   * when the adjustments page links here after a `404`.
   */
  protected readonly skuControl = new FormControl<string | null>(
    this.route.snapshot.queryParamMap.get('sku'),
    {
      validators: [Validators.required, Validators.maxLength(64)],
    },
  );

  /**
   * On-hand quantity editor control (presence plus non-negative
   * whole-number shape — zero admits empty initial stock; the
   * documented range stays backend-owned).
   */
  protected readonly quantityControl = new FormControl<string | null>(null, {
    validators: [Validators.required, Validators.pattern(/^\d+$/)],
  });

  /** Creation form group (owns the `ngSubmit` output the template binds). */
  protected readonly form = new FormGroup({
    sku: this.skuControl,
    quantity: this.quantityControl,
  });

  /** Submission in flight (actions lock, duplicate submits no-op). */
  protected readonly submitting = signal(false);

  /** Form-level failure notice (`null` when clean). */
  protected readonly formError = signal<string | null>(null);

  /** Created stock record from the last successful creation (`null` until then). */
  protected readonly result = signal<AdminStockRow | null>(null);

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      heading: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.newItemTitle),
      subheading: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.newItemSubtitle),
      skuLabel: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.newItemSkuLabel),
      skuPlaceholder: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.newItemSkuPlaceholder,
      ),
      quantityLabel: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.newItemQuantityLabel,
      ),
      quantityHint: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.newItemQuantityHint),
      submit: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.newItemSubmit),
      saving: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.newItemSaving),
      formErrorTitle: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.newItemFormErrorTitle,
      ),
      resultTitle: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.newItemResultTitle),
      viewStock: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.newItemViewStock),
      factSku: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockFactSku),
      factOnHand: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockFactOnHand),
      factReserved: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockFactReserved),
      factAvailable: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockFactAvailable),
      factUpdated: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockFactUpdated),
    };
  });

  /**
   * Submits the creation form: closes over validated input, then runs
   * the backend call under the submit lock. Success notifies and renders
   * the backend-returned created record; failures project `400` field
   * maps onto their controls and render everything else (including
   * `409` duplicate SKU) as the form-level notice with user input
   * preserved.
   */
  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) {
      return;
    }
    const body = toCreateInventoryItemRequest(this.skuControl.value, this.quantityControl.value);
    if (body.sku === '') {
      return;
    }
    this.submitting.set(true);
    this.formError.set(null);
    this.clearServerErrors();
    this.inventoryApi.createItem(body).subscribe({
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
          translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.newItemSuccessTitle),
          translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.newItemSuccessMessage, {
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
    const culture = this.cultures.culture();
    this.formError.set(
      isApiError(error)
        ? resolveApiErrorMessage(error, culture)
        : translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.newItemFormErrorTitle),
    );
  }

  private failGeneric(): void {
    this.submitting.set(false);
    this.formError.set(
      translateInventoryKey(
        this.cultures.culture(),
        INVENTORY_TRANSLATION_KEYS.newItemFormErrorTitle,
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
