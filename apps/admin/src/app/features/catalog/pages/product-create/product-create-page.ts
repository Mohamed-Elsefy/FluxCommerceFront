/**
 * Admin product create page for Sub-Phase 13.3 — Product Management.
 *
 * Smart page (route-level composition): owns the submission transport
 * for `POST /catalog/products` — submit lock, backend-error mapping,
 * success notification, and post-create navigation — over the dumb
 * `product-form` (typed controls + client validators) and the
 * `CategoryLookupState` (select options).
 *
 * Error discipline: `400` validation maps project onto their controls
 * (`applyServerErrors`, rendered verbatim backend-localized); unknown
 * keys and non-validation failures render as the form-level notice
 * (never a silent no-op). Success notifies with the created name and
 * navigates to the details page (`/catalog/products/{id}` from the
 * `201` envelope — a dataless envelope is a contract violation, never a
 * blind navigation). The submit lock (`submitting`) plus the state-level
 * guards prevent duplicate submissions.
 *
 * SSR/hydration safe: signals plus markup, no browser APIs. RTL safe:
 * logical properties only.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { CultureService, resolveApiErrorMessage, translateKey } from '@flux/i18n';
import { ApiError, isApiError, UNKNOWN_ERROR_CODE } from '@flux/api';
import { ErrorState } from '@flux/ui';
import { AdminNotificationService } from '../../../../shared/notifications/notification-service';
import { CatalogAdminApiService } from '../../data-access/catalog-admin-api.service';
import { CategoryLookupState } from '../../state/category-lookup-state';
import {
  emptyProductFormValue,
  toCreateProductRequest,
  type ProductFormValue,
} from '../../models/catalog-admin.models';
import { ProductForm, type ProductFormCopy } from '../../components/product-form/product-form';
import { CATALOG_TRANSLATION_KEYS, translateCatalogKey } from '../../i18n/catalog-translations';

@Component({
  selector: 'app-product-create-page',
  imports: [ProductForm, ErrorState],
  templateUrl: './product-create-page.html',
  styleUrl: './product-create-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCreatePage implements OnInit {
  private readonly catalogApi = inject(CatalogAdminApiService);
  private readonly lookup = inject(CategoryLookupState);
  private readonly cultures = inject(CultureService);
  private readonly notifications = inject(AdminNotificationService);
  private readonly router = inject(Router);

  private readonly productForm = viewChild(ProductForm);

  /** Blank initial value for the create form. */
  protected readonly initial = emptyProductFormValue();

  /** Submission in flight (actions lock, duplicate submits no-op). */
  protected readonly submitting = signal(false);

  /** Form-level failure notice (`null` when clean). */
  protected readonly formError = signal<string | null>(null);

  /** Category options with the localized empty first option. */
  protected readonly categoryOptions = computed(() => [
    {
      value: '',
      label: translateCatalogKey(
        this.cultures.culture(),
        CATALOG_TRANSLATION_KEYS.formCategoryPlaceholder,
      ),
    },
    ...this.lookup.options(),
  ]);

  /** Visibility options with the localized empty first option. */
  protected readonly visibilityOptions = computed(() => {
    const culture = this.cultures.culture();
    return [
      {
        value: '',
        label: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formSelectPlaceholder),
      },
      {
        value: String(0),
        label: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formVisibilityVisible),
      },
      {
        value: String(1),
        label: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formVisibilityHidden),
      },
    ];
  });

  /** Localized form copy for the active culture. */
  protected readonly formCopy = computed((): ProductFormCopy => {
    const culture = this.cultures.culture();
    return {
      name: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formName),
      slug: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formSlug),
      slugHint: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formSlugHint),
      description: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formDescription),
      category: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formCategory),
      visibility: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formVisibility),
      seoTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formSeoTitle),
      seoDescription: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formSeoDescription),
      seoKeywords: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formSeoKeywords),
      seoKeywordsHint: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formSeoKeywordsHint),
      submit: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formCreate),
      cancel: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formCancel),
      saving: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formSaving),
    };
  });

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      heading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.createHeading),
      subheading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.createSubheading),
      errorTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formErrorTitle),
      lookupTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsSectionError),
      retry: translateKey(culture, 'common.actions.retry'),
    };
  });

  /**
   * Category-lookup failure notice (`null` when clean). A failed lookup
   * leaves the required category select empty with no valid choice, so
   * the failure renders explicitly instead of failing silently — the
   * form itself stays usable for every other field.
   */
  protected readonly lookupError = computed(() =>
    this.lookup.categories().isError
      ? resolveApiErrorMessage(this.lookup.categories().error, this.cultures.culture())
      : null,
  );

  /** Lookup retry reloads the category snapshot. */
  protected retryLookup(): void {
    this.lookup.load();
  }

  ngOnInit(): void {
    this.lookup.load();
  }

  /**
   * Submits the validated form value. Re-entrant calls while a submit is
   * in flight are no-ops; every attempt starts with cleared server
   * errors so stale messages never survive a retry.
   */
  protected onSave(value: ProductFormValue): void {
    if (this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.formError.set(null);
    this.productForm()?.clearServerErrors();
    this.catalogApi.createProduct(toCreateProductRequest(value)).subscribe({
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
        const name = value.name?.trim() || id;
        this.notifications.success(
          translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.createSuccessTitle),
          translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.createSuccessMessage, { name }),
        );
        void this.router.navigate(['/catalog/products', id]);
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  /** Cancels back to the product list. */
  protected onCancel(): void {
    void this.router.navigate(['/catalog/products']);
  }

  private fail(error: unknown): void {
    this.submitting.set(false);
    const form = this.productForm();
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
        : translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formErrorTitle),
    );
  }
}
