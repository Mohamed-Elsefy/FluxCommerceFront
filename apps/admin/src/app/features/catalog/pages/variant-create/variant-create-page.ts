/**
 * Admin variant create page for Sub-Phase 13.4 — Product Variants
 * Management.
 *
 * Smart page (route-level composition) within the product context
 * (`/catalog/products/:productId/variants/new`): owns the submission
 * transport for `POST /catalog/products/{productId}/variants` — submit
 * lock, backend-error mapping, success notification, and post-create
 * navigation — over the dumb `variant-form` in `create` mode (all
 * fields editable: SKU, name, price, currency).
 *
 * Error discipline: `400` validation maps project onto their controls
 * (`applyServerErrors`, rendered verbatim backend-localized — SKU
 * uniqueness and price rules surface here, never as client logic);
 * unknown keys and non-validation failures render as the form-level
 * notice. Success notifies with the created SKU and navigates to the
 * variant details page (from the `201` envelope — a dataless envelope
 * is a contract violation, never a blind navigation).
 *
 * SSR/hydration safe: signals plus markup, no browser APIs. RTL safe:
 * logical properties only.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { CultureService, resolveApiErrorMessage } from '@flux/i18n';
import { ApiError, isApiError, UNKNOWN_ERROR_CODE } from '@flux/api';
import { ErrorState } from '@flux/ui';
import { AdminNotificationService } from '../../../../shared/notifications/notification-service';
import { CatalogAdminApiService } from '../../data-access/catalog-admin-api.service';
import {
  emptyVariantFormValue,
  toCreateVariantRequest,
  type VariantFormValue,
} from '../../models/catalog-admin.models';
import { VariantForm, type VariantFormCopy } from '../../components/variant-form/variant-form';
import { CATALOG_TRANSLATION_KEYS, translateCatalogKey } from '../../i18n/catalog-translations';

@Component({
  selector: 'app-variant-create-page',
  imports: [VariantForm, ErrorState],
  templateUrl: './variant-create-page.html',
  styleUrl: './variant-create-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VariantCreatePage {
  private readonly catalogApi = inject(CatalogAdminApiService);
  private readonly cultures = inject(CultureService);
  private readonly notifications = inject(AdminNotificationService);
  private readonly router = inject(Router);

  private readonly variantForm = viewChild(VariantForm);

  /** Route product id (`null` until the first param emission). */
  private readonly productId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('productId'))),
    { initialValue: null as string | null },
  );

  /** Blank initial value for the create form. */
  protected readonly initial = emptyVariantFormValue();

  /** Submission in flight (actions lock, duplicate submits no-op). */
  protected readonly submitting = signal(false);

  /** Form-level failure notice (`null` when clean). */
  protected readonly formError = signal<string | null>(null);

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
      submit: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantFormCreate),
      cancel: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantFormCancel),
      saving: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantFormSaving),
    };
  });

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      heading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantCreateHeading),
      subheading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantCreateSubheading),
      errorTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantFormErrorTitle),
    };
  });

  /**
   * Submits the validated form value against the route product id.
   * Re-entrant calls while a submit is in flight are no-ops; every
   * attempt starts with cleared server errors.
   */
  protected onSave(value: VariantFormValue): void {
    const productId = this.productId();
    if (this.submitting() || productId === null) {
      return;
    }
    this.submitting.set(true);
    this.formError.set(null);
    this.variantForm()?.clearServerErrors();
    this.catalogApi.createVariant(productId, toCreateVariantRequest(value)).subscribe({
      next: (envelope) => {
        const id = envelope.data ?? null;
        if (id === null) {
          this.fail(
            new ApiError({
              status: 200,
              code: UNKNOWN_ERROR_CODE,
              message: 'The server returned an empty response.',
            }),
          );
          return;
        }
        const culture = this.cultures.culture();
        const sku = value.sku?.trim() || id;
        this.notifications.success(
          translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantCreateSuccessTitle),
          translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantCreateSuccessMessage, {
            sku,
          }),
        );
        void this.router.navigate([`/catalog/products/${productId}/variants`, id]);
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  /** Cancels back to the variant list. */
  protected onCancel(): void {
    const productId = this.productId();
    void this.router.navigate(
      productId === null ? ['/catalog/products'] : [`/catalog/products/${productId}/variants`],
    );
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
