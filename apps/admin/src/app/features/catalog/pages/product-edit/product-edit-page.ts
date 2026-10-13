/**
 * Admin product edit page for Sub-Phase 13.3 — Product Management.
 *
 * Smart page (route-level composition): loads the product through the
 * feature-scoped `ProductDetailsState` product slot (route-provided —
 * never a global store), populates the dumb `product-form` once settled,
 * and owns the `PUT /catalog/products/{id}` submission transport with
 * the same error discipline as the create page.
 *
 * Error discipline: product-load failures render the page-level error
 * state with retry (the form mounts only on success, so population can
 * never race). Submit failures project `400` field maps onto their
 * controls and render everything else as the form-level notice; `409`
 * conflicts (duplicate name/slug, deleted-product mutation) surface the
 * same way with backend data preserved — nothing the user typed is
 * lost. Success notifies and navigates to the details page.
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
  OnInit,
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
import { CategoryLookupState } from '../../state/category-lookup-state';
import { ProductDetailsState } from '../../state/product-details-state';
import {
  productToFormValue,
  toUpdateProductRequest,
  type ProductFormValue,
} from '../../models/catalog-admin.models';
import { ProductForm, type ProductFormCopy } from '../../components/product-form/product-form';
import { CATALOG_TRANSLATION_KEYS, translateCatalogKey } from '../../i18n/catalog-translations';

@Component({
  selector: 'app-product-edit-page',
  imports: [ProductForm, ErrorState, LoadingIndicator],
  templateUrl: './product-edit-page.html',
  styleUrl: './product-edit-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductEditPage implements OnInit {
  private readonly catalogApi = inject(CatalogAdminApiService);
  private readonly details = inject(ProductDetailsState);
  private readonly lookup = inject(CategoryLookupState);
  private readonly cultures = inject(CultureService);
  private readonly notifications = inject(AdminNotificationService);
  private readonly router = inject(Router);

  private readonly productForm = viewChild(ProductForm);

  /** Route product id (`null` until the first param emission). */
  private readonly productId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id'))),
    { initialValue: null as string | null },
  );

  /** Submission in flight (actions lock, duplicate submits no-op). */
  protected readonly submitting = signal(false);

  /** Form-level failure notice (`null` when clean). */
  protected readonly formError = signal<string | null>(null);

  /** Current product slot (idle → loading → success | empty | error). */
  protected readonly product = this.details.product;

  constructor() {
    // Populates through the product slot alone (display sections belong
    // to the details page). Runs `untracked` so settled responses never
    // reschedule the effect — the route id is the only dependency.
    effect(() => {
      const id = this.productId();
      untracked(() => {
        if (id !== null) {
          this.details.loadProduct(id);
        }
      });
    });
  }

  ngOnInit(): void {
    this.lookup.load();
  }

  /** Form initial value once the product settles (`null` hides the form). */
  protected readonly initial = computed((): ProductFormValue | null => {
    const data = this.product().data;
    return data === null ? null : productToFormValue(data);
  });

  /**
   * Category-lookup failure notice (`null` when clean). A failed lookup
   * leaves the required category select empty with no valid choice, so
   * the failure renders explicitly instead of failing silently.
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
      submit: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formSave),
      cancel: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formCancel),
      saving: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formSaving),
    };
  });

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    const name = this.product().data?.name ?? '';
    return {
      heading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.editHeading),
      subheading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.editSubheading, { name }),
      loading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listLoading),
      errorTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listErrorTitle),
      retry: translateKey(culture, 'common.actions.retry'),
      formErrorTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formErrorTitle),
      lookupTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsSectionError),
    };
  });

  /** Localized product-load failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.product().error, this.cultures.culture()),
  );

  /**
   * Submits the validated form value against the route id. Re-entrant
   * calls while a submit is in flight are no-ops; conflict and
   * validation failures keep the form (and its data) intact.
   */
  protected onSave(value: ProductFormValue): void {
    const id = this.productId();
    if (this.submitting() || id === null) {
      return;
    }
    this.submitting.set(true);
    this.formError.set(null);
    this.productForm()?.clearServerErrors();
    this.catalogApi.updateProduct(id, toUpdateProductRequest(value)).subscribe({
      next: () => {
        const culture = this.cultures.culture();
        const name = value.name?.trim() || id;
        this.notifications.success(
          translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.editSuccessTitle),
          translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.editSuccessMessage, { name }),
        );
        void this.router.navigate(['/catalog/products', id]);
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  /** Cancels back to the product details page. */
  protected onCancel(): void {
    const id = this.productId();
    void this.router.navigate(id === null ? ['/catalog/products'] : ['/catalog/products', id]);
  }

  /** Product-load retry re-enters the product slot for the route id. */
  protected retry(): void {
    const id = this.productId();
    if (id !== null) {
      this.details.loadProduct(id);
    }
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
