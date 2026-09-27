/**
 * Admin category create page for Sub-Phase 13.5 — Category Management.
 *
 * Smart page (route-level composition): owns the submission transport
 * for `POST /catalog/categories` — submit lock, backend-error mapping,
 * success notification, and post-create navigation — over the dumb
 * `category-form` and the `CategoryLookupState` (parent options).
 *
 * Error discipline: `400` validation maps project onto their controls
 * (`applyServerErrors`, rendered verbatim backend-localized);
 * unknown keys and non-validation failures (duplicate name/slug
 * `409`s included) render as the form-level notice. Success notifies
 * with the created name and navigates to the details page (from the
 * `201` envelope — a dataless envelope is a contract violation, never
 * a blind navigation).
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
  emptyCategoryFormValue,
  toCreateCategoryRequest,
  type CategoryFormValue,
} from '../../models/catalog-admin.models';
import { CategoryForm, type CategoryFormCopy } from '../../components/category-form/category-form';
import { CATALOG_TRANSLATION_KEYS, translateCatalogKey } from '../../i18n/catalog-translations';

@Component({
  selector: 'app-category-create-page',
  imports: [CategoryForm, ErrorState],
  templateUrl: './category-create-page.html',
  styleUrl: './category-create-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryCreatePage implements OnInit {
  private readonly catalogApi = inject(CatalogAdminApiService);
  private readonly lookup = inject(CategoryLookupState);
  private readonly cultures = inject(CultureService);
  private readonly notifications = inject(AdminNotificationService);
  private readonly router = inject(Router);

  private readonly categoryForm = viewChild(CategoryForm);

  /** Blank initial value for the create form. */
  protected readonly initial = emptyCategoryFormValue();

  /** Submission in flight (actions lock, duplicate submits no-op). */
  protected readonly submitting = signal(false);

  /** Form-level failure notice (`null` when clean). */
  protected readonly formError = signal<string | null>(null);

  /** Parent options with the localized empty top-level option first. */
  protected readonly parentOptions = computed(() => [
    {
      value: '',
      label: translateCatalogKey(
        this.cultures.culture(),
        CATALOG_TRANSLATION_KEYS.categoryFormParentPlaceholder,
      ),
    },
    ...this.lookup.options(),
  ]);

  /** Localized form copy for the active culture. */
  protected readonly formCopy = computed((): CategoryFormCopy => {
    const culture = this.cultures.culture();
    return {
      name: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formName),
      slug: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formSlug),
      slugHint: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formSlugHint),
      description: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formDescription),
      parent: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoryFormParent),
      submit: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoryFormCreate),
      cancel: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoryFormCancel),
      saving: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoryFormSaving),
    };
  });

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      heading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoryCreateHeading),
      subheading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoryCreateSubheading),
      errorTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoryFormErrorTitle),
      lookupTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsSectionError),
      retry: translateKey(culture, 'common.actions.retry'),
    };
  });

  /**
   * Parent-lookup failure notice (`null` when clean). The parent select
   * degrades to top-level-only when the lookup fails, so the failure
   * renders explicitly instead of failing silently.
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
   * errors.
   */
  protected onSave(value: CategoryFormValue): void {
    if (this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.formError.set(null);
    this.categoryForm()?.clearServerErrors();
    this.catalogApi.createCategory(toCreateCategoryRequest(value)).subscribe({
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
          translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoryCreateSuccessTitle),
          translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoryCreateSuccessMessage, {
            name,
          }),
        );
        void this.router.navigate(['/catalog/categories', id]);
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  /** Cancels back to the category list. */
  protected onCancel(): void {
    void this.router.navigate(['/catalog/categories']);
  }

  private fail(error: unknown): void {
    this.submitting.set(false);
    const form = this.categoryForm();
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
        : translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoryFormErrorTitle),
    );
  }
}
