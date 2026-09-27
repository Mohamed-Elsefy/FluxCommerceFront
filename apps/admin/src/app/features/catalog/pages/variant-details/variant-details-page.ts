/**
 * Admin variant details page for Sub-Phase 13.4 — Product Variants
 * Management.
 *
 * Smart page (route-level composition) within the product context
 * (`/catalog/products/:productId/variants/:variantId`): reads the
 * feature-scoped `VariantDetailsState` (route-provided `catalogRoutes`
 * entry — never a global store) and renders the backend-issued variant
 * record — SKU, name, price (display only, never an input to math),
 * status badge (unknown-safe), timestamps — plus the edit link and the
 * deletion flow.
 *
 * Deletion contract: the backend exposes no variant disable/lifecycle
 * transition, so deletion (behind confirmation, with duplicate-submit
 * prevention through the local lock) is the only removal operation.
 * Success notifies and returns to the variant list; failures notify
 * with the resolved message and keep the page. Availability/stock
 * display belongs to the Inventory feature (13.9+) — this page performs
 * no inventory reads.
 *
 * Resource states: the variant slot drives the page (loading/error
 * with retry); failures resolve through `resolveApiErrorMessage`
 * (never backend text).
 *
 * SSR/hydration safe: signals plus markup, no browser APIs. RTL safe:
 * logical properties only.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { CultureService, formatCurrency, resolveApiErrorMessage, translateKey } from '@flux/i18n';
import { Badge, type BadgeVariant, Card, ErrorState, LoadingIndicator } from '@flux/ui';
import { isApiError } from '@flux/api';
import { AdminDialog } from '../../../../shared/dialog/dialog';
import { AdminNotificationService } from '../../../../shared/notifications/notification-service';
import { CatalogAdminApiService } from '../../data-access/catalog-admin-api.service';
import { VariantDetailsState } from '../../state/variant-details-state';
import { variantStatusDisplay } from '../../models/catalog-admin.models';
import { CATALOG_TRANSLATION_KEYS, translateCatalogKey } from '../../i18n/catalog-translations';

@Component({
  selector: 'app-variant-details-page',
  imports: [RouterLink, AdminDialog, Badge, Card, ErrorState, LoadingIndicator],
  templateUrl: './variant-details-page.html',
  styleUrl: './variant-details-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VariantDetailsPage {
  private readonly details = inject(VariantDetailsState);
  private readonly catalogApi = inject(CatalogAdminApiService);
  private readonly cultures = inject(CultureService);
  private readonly notifications = inject(AdminNotificationService);
  private readonly router = inject(Router);

  private readonly routeIds = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      map((params) => ({
        productId: params.get('productId'),
        variantId: params.get('variantId'),
      })),
    ),
    { initialValue: { productId: null as string | null, variantId: null as string | null } },
  );

  /** Whether the confirmation dialog is open (feature-owned). */
  protected readonly confirmOpen = signal(false);

  /** Deletion in flight (dialog actions lock). */
  protected readonly deleting = signal(false);

  /** Current variant slot (idle → loading → success | empty | error). */
  protected readonly variant = this.details.variant;

  constructor() {
    // Drives the slot from the route ids (initial value included,
    // changes followed). Runs `untracked` so settled responses never
    // reschedule the effect — the ids are the only dependency.
    effect(() => {
      const ids = this.routeIds();
      untracked(() => {
        if (ids.productId !== null && ids.variantId !== null) {
          this.details.load(ids.productId, ids.variantId);
        }
      });
    });
  }

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    const record = this.variant().data;
    return {
      back: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantDetailsBack),
      edit: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantDetailsEdit),
      loading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantsLoading),
      errorTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantsErrorTitle),
      retry: translateKey(culture, 'common.actions.retry'),
      sku: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantDetailsSku),
      name: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantDetailsName),
      price: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantDetailsPrice),
      status: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantDetailsStatus),
      created: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantDetailsCreated),
      delete: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantDetailsDelete),
      confirmTitle: translateCatalogKey(
        culture,
        CATALOG_TRANSLATION_KEYS.variantDetailsConfirmTitle,
      ),
      confirmMessage: translateCatalogKey(
        culture,
        CATALOG_TRANSLATION_KEYS.variantDetailsConfirmMessage,
        { sku: record?.sku ?? '' },
      ),
      confirm: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.lifecycleConfirm),
      cancel: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.lifecycleCancel),
      priceText:
        record === null ? '' : formatCurrency(record.unitPriceAmount, record.currency, culture),
    };
  });

  /** Status badge (label + variant, unknown-safe). */
  protected readonly statusBadge = computed((): { label: string; variant: BadgeVariant } | null => {
    const status = this.variant().data?.status;
    if (status === undefined || status === null) {
      return null;
    }
    const display = variantStatusDisplay(status);
    return {
      label: translateCatalogKey(this.cultures.culture(), display.labelKey, {
        value: String(status),
      }),
      variant: display.variant,
    };
  });

  /** Localized failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.variant().error, this.cultures.culture()),
  );

  /** Back link to the variant list (`null` until the product id emits). */
  protected backLink(): string | null {
    const productId = this.routeIds().productId;
    return productId === null ? null : `/catalog/products/${productId}/variants`;
  }

  /** Edit link for the loaded variant (`null` until both ids emit). */
  protected editLink(): string | null {
    const ids = this.routeIds();
    return ids.productId === null || ids.variantId === null
      ? null
      : `/catalog/products/${ids.productId}/variants/${ids.variantId}/edit`;
  }

  /** Variant retry reloads the current route scope. */
  protected retry(): void {
    const ids = this.routeIds();
    if (ids.productId !== null && ids.variantId !== null) {
      this.details.load(ids.productId, ids.variantId);
    }
  }

  /** Opens the deletion confirmation dialog. */
  protected requestDelete(): void {
    this.confirmOpen.set(true);
  }

  /** Closes the deletion confirmation dialog without acting. */
  protected cancelDelete(): void {
    this.confirmOpen.set(false);
  }

  /**
   * Confirms deletion: closes the dialog first (duplicate clicks cannot
   * re-enter), then runs the backend call under the local lock. Success
   * notifies and returns to the variant list; failures notify with the
   * resolved message and keep the page.
   */
  protected confirmDelete(): void {
    const { productId, variantId } = this.routeIds();
    this.confirmOpen.set(false);
    if (productId === null || variantId === null || this.deleting()) {
      return;
    }
    const sku = this.variant().data?.sku ?? variantId;
    this.deleting.set(true);
    this.catalogApi.deleteVariant(productId, variantId).subscribe({
      next: () => {
        const culture = this.cultures.culture();
        this.notifications.success(
          translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantDetailsDeleteSuccessTitle),
          translateCatalogKey(
            culture,
            CATALOG_TRANSLATION_KEYS.variantDetailsDeleteSuccessMessage,
            { sku },
          ),
        );
        void this.router.navigate([`/catalog/products/${productId}/variants`]);
      },
      error: (error: unknown) => {
        this.deleting.set(false);
        const culture = this.cultures.culture();
        this.notifications.error(
          translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantDetailsDeleteFailureTitle),
          isApiError(error)
            ? resolveApiErrorMessage(error, culture)
            : translateCatalogKey(
                culture,
                CATALOG_TRANSLATION_KEYS.variantDetailsDeleteFailureTitle,
              ),
        );
      },
    });
  }
}
