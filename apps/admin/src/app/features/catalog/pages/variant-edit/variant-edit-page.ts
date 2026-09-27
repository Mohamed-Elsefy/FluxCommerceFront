/**
 * Admin variant edit page for Sub-Phase 13.4 — Product Variants
 * Management.
 *
 * Smart page (route-level composition) within the product context
 * (`/catalog/products/:productId/variants/:variantId/edit`): loads the
 * variant through the feature-scoped `VariantDetailsState` (route-
 * provided — never a global store), populates the dumb `variant-form`
 * in `edit` mode once settled, and owns the
 * `PUT .../variants/{variantId}` submission transport with the same
 * error discipline as the create page.
 *
 * Contract-shaped editing: the form locks price and currency as
 * read-only display (the update endpoint accepts `sku` + `name` only),
 * and the submit projects exactly those two fields. Error discipline:
 * the variant loads behind page-level loading/error states (the form
 * mounts only on success, so population can never race); submit
 * failures project `400` field maps onto their controls and render
 * everything else — including `409` duplicate-SKU conflicts — as the
 * form-level notice with user input preserved. Success notifies and
 * navigates to the variant details page.
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
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { CultureService, resolveApiErrorMessage, translateKey } from '@flux/i18n';
import { isApiError } from '@flux/api';
import { ErrorState, LoadingIndicator } from '@flux/ui';
import { AdminNotificationService } from '../../../../shared/notifications/notification-service';
import { CatalogAdminApiService } from '../../data-access/catalog-admin-api.service';
import { VariantDetailsState } from '../../state/variant-details-state';
import {
  toUpdateVariantRequest,
  variantToFormValue,
  type VariantFormValue,
} from '../../models/catalog-admin.models';
import { VariantForm, type VariantFormCopy } from '../../components/variant-form/variant-form';
import { CATALOG_TRANSLATION_KEYS, translateCatalogKey } from '../../i18n/catalog-translations';

@Component({
  selector: 'app-variant-edit-page',
  imports: [VariantForm, ErrorState, LoadingIndicator],
  templateUrl: './variant-edit-page.html',
  styleUrl: './variant-edit-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VariantEditPage {
  private readonly catalogApi = inject(CatalogAdminApiService);
  private readonly details = inject(VariantDetailsState);
  private readonly cultures = inject(CultureService);
  private readonly notifications = inject(AdminNotificationService);
  private readonly router = inject(Router);

  private readonly variantForm = viewChild(VariantForm);

  private readonly routeIds = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      map((params) => ({
        productId: params.get('productId'),
        variantId: params.get('variantId'),
      })),
    ),
    { initialValue: { productId: null as string | null, variantId: null as string | null } },
  );

  /** Submission in flight (actions lock, duplicate submits no-op). */
  protected readonly submitting = signal(false);

  /** Form-level failure notice (`null` when clean). */
  protected readonly formError = signal<string | null>(null);

  /** Current variant slot (idle → loading → success | empty | error). */
  protected readonly variant = this.details.variant;

  constructor() {
    // Populates through the variant slot alone. Runs `untracked` so
    // settled responses never reschedule the effect — the ids are the
    // only dependency.
    effect(() => {
      const ids = this.routeIds();
      untracked(() => {
        if (ids.productId !== null && ids.variantId !== null) {
          this.details.load(ids.productId, ids.variantId);
        }
      });
    });
  }

  /** Form initial value once the variant settles (`null` hides the form). */
  protected readonly initial = computed((): VariantFormValue | null => {
    const data = this.variant().data;
    return data === null ? null : variantToFormValue(data);
  });

  /** Localized form copy for the active culture. */
  protected readonly formCopy = computed((): VariantFormCopy => {
    const culture = this.cultures.culture();
    return {
      sku: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantFormSku),
      name: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantFormName),
      price: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantFormPrice),
      currency: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantFormCurrency),
      currencyHint: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantFormCurrencyHint),
      priceLockedHint: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantFormLockedHint),
      submit: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantFormSave),
      cancel: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantFormCancel),
      saving: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantFormSaving),
    };
  });

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      heading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantEditHeading),
      subheading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantEditSubheading),
      loading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantsLoading),
      errorTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantsErrorTitle),
      retry: translateKey(culture, 'common.actions.retry'),
      formErrorTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantFormErrorTitle),
    };
  });

  /** Localized variant-load failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.variant().error, this.cultures.culture()),
  );

  /**
   * Submits the validated form value against the route scope.
   * Re-entrant calls while a submit is in flight are no-ops; failures
   * keep the form (and its data) intact.
   */
  protected onSave(value: VariantFormValue): void {
    const { productId, variantId } = this.routeIds();
    if (this.submitting() || productId === null || variantId === null) {
      return;
    }
    this.submitting.set(true);
    this.formError.set(null);
    this.variantForm()?.clearServerErrors();
    this.catalogApi.updateVariant(productId, variantId, toUpdateVariantRequest(value)).subscribe({
      next: () => {
        const culture = this.cultures.culture();
        const sku = value.sku?.trim() || variantId;
        this.notifications.success(
          translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantEditSuccessTitle),
          translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantEditSuccessMessage, {
            sku,
          }),
        );
        void this.router.navigate([`/catalog/products/${productId}/variants`, variantId]);
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  /** Cancels back to the variant details page. */
  protected onCancel(): void {
    const ids = this.routeIds();
    void this.router.navigate(
      ids.productId === null || ids.variantId === null
        ? ['/catalog/products']
        : [`/catalog/products/${ids.productId}/variants`, ids.variantId],
    );
  }

  /** Variant-load retry reloads the current route scope. */
  protected retry(): void {
    const ids = this.routeIds();
    if (ids.productId !== null && ids.variantId !== null) {
      this.details.load(ids.productId, ids.variantId);
    }
  }

  private fail(error: unknown): void {
    this.submitting.set(false);
    const form = this.variantForm();
    if (isApiError(error) && error.status === 400 && error.validationErrors !== undefined) {
      const unknown = form?.applyServerErrors(error.validationErrors) ?? [];
      if (unknown.length === 0) {
        return;
      }
    }
    const culture = this.cultures.culture();
    this.formError.set(
      isApiError(error)
        ? resolveApiErrorMessage(error, culture)
        : translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantFormErrorTitle),
    );
  }
}
