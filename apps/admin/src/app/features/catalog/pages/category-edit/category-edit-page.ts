/**
 * Admin category edit page for Sub-Phase 13.5 — Category Management.
 *
 * Smart page (route-level composition): loads the category through the
 * feature-scoped `CategoryDetailsState` (route-provided — never a global
 * store), populates the dumb `category-form` once settled, and owns the
 * `PUT /catalog/categories/{id}` submission transport with the same
 * error discipline as the create page.
 *
 * Parent options exclude the edited category itself: self-parenting is
 * a guaranteed backend `400` (`CannotBeOwnParent`), so the UI does not
 * offer it — every other parent rule (deleted parents, cycles beyond
 * depth one) stays backend-owned and surfaces through the same
 * field/form error channels. Submit failures keep the form (and its
 * data) intact; success notifies and navigates to the details page.
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
import { CategoryDetailsState } from '../../state/category-details-state';
import { CategoryLookupState } from '../../state/category-lookup-state';
import {
  categoryToFormValue,
  toUpdateCategoryRequest,
  type CategoryFormValue,
} from '../../models/catalog-admin.models';
import { CategoryForm, type CategoryFormCopy } from '../../components/category-form/category-form';
import { CATALOG_TRANSLATION_KEYS, translateCatalogKey } from '../../i18n/catalog-translations';

@Component({
  selector: 'app-category-edit-page',
  imports: [CategoryForm, ErrorState, LoadingIndicator],
  templateUrl: './category-edit-page.html',
  styleUrl: './category-edit-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryEditPage implements OnInit {
  private readonly catalogApi = inject(CatalogAdminApiService);
  private readonly details = inject(CategoryDetailsState);
  private readonly lookup = inject(CategoryLookupState);
  private readonly cultures = inject(CultureService);
  private readonly notifications = inject(AdminNotificationService);
  private readonly router = inject(Router);

  private readonly categoryForm = viewChild(CategoryForm);

  /** Route category id (`null` until the first param emission). */
  private readonly categoryId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id'))),
    { initialValue: null as string | null },
  );

  /** Submission in flight (actions lock, duplicate submits no-op). */
  protected readonly submitting = signal(false);

  /** Form-level failure notice (`null` when clean). */
  protected readonly formError = signal<string | null>(null);

  /** Current category slot (idle → loading → success | empty | error). */
  protected readonly category = this.details.category;

  constructor() {
    // Populates through the category slot alone. Runs `untracked` so
    // settled responses never reschedule the effect — the id is the
    // only dependency.
    effect(() => {
      const id = this.categoryId();
      untracked(() => {
        if (id !== null) {
          this.details.load(id);
        }
      });
    });
  }

  ngOnInit(): void {
    this.lookup.load();
  }

  /** Form initial value once the category settles (`null` hides the form). */
  protected readonly initial = computed((): CategoryFormValue | null => {
    const data = this.category().data;
    return data === null ? null : categoryToFormValue(data);
  });

  /**
   * Parent options with the localized empty top-level option first,
   * excluding the edited category itself (self-parenting is a
   * guaranteed backend rejection — never offered as a choice).
   */
  protected readonly parentOptions = computed(() => {
    const culture = this.cultures.culture();
    const self = this.categoryId();
    return [
      {
        value: '',
        label: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoryFormParentPlaceholder),
      },
      ...this.lookup.options().filter((option) => option.value !== self),
    ];
  });

  /** Localized form copy for the active culture. */
  protected readonly formCopy = computed((): CategoryFormCopy => {
    const culture = this.cultures.culture();
    return {
      name: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formName),
      slug: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formSlug),
      slugHint: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formSlugHint),
      description: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.formDescription),
      parent: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoryFormParent),
      submit: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoryFormSave),
      cancel: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoryFormCancel),
      saving: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoryFormSaving),
    };
  });

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    const name = this.category().data?.name ?? '';
    return {
      heading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoryEditHeading),
      subheading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoryEditSubheading, {
        name,
      }),
      loading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesLoading),
      errorTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesErrorTitle),
      retry: translateKey(culture, 'common.actions.retry'),
      formErrorTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoryFormErrorTitle),
      lookupTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsSectionError),
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

  /** Localized category-load failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.category().error, this.cultures.culture()),
  );

  /**
   * Submits the validated form value against the route id. Re-entrant
   * calls while a submit is in flight are no-ops; failures keep the
   * form (and its data) intact.
   */
  protected onSave(value: CategoryFormValue): void {
    const id = this.categoryId();
    if (this.submitting() || id === null) {
      return;
    }
    this.submitting.set(true);
    this.formError.set(null);
    this.categoryForm()?.clearServerErrors();
    this.catalogApi.updateCategory(id, toUpdateCategoryRequest(value)).subscribe({
      next: () => {
        const culture = this.cultures.culture();
        const name = value.name?.trim() || id;
        this.notifications.success(
          translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoryEditSuccessTitle),
          translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoryEditSuccessMessage, {
            name,
          }),
        );
        void this.router.navigate(['/catalog/categories', id]);
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  /** Cancels back to the category details page. */
  protected onCancel(): void {
    const id = this.categoryId();
    void this.router.navigate(id === null ? ['/catalog/categories'] : ['/catalog/categories', id]);
  }

  /** Category-load retry re-enters the category slot for the route id. */
  protected retry(): void {
    const id = this.categoryId();
    if (id !== null) {
      this.details.load(id);
    }
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
