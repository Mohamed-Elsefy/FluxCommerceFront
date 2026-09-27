/**
 * Admin category details page for Sub-Phase 13.5 — Category Management.
 *
 * Smart page (route-level composition): reads the feature-scoped
 * `CategoryDetailsState` (route-provided `catalogRoutes` entry — never a
 * global store) for the category slot and lifecycle transitions, plus
 * the `CategoryLookupState` (parent display name).
 *
 * Display contract (13.1 audit — only backend-exposed data): name, slug,
 * description, status badge (unknown-safe), parent reference (name via
 * lookup, raw-id fallback, `—` for top-level), timestamps. Hierarchy
 * follows the flat backend model — no tree rendering exists because no
 * tree endpoint exists.
 *
 * Lifecycle contract: every supported transition (`activate`,
 * `deactivate`, `soft-delete`, `restore` — there is no `archive` for
 * categories) runs behind a confirmation dialog with duplicate-submit
 * prevention (state lock + dialog dismissal on confirm). The backend
 * owns transition validity — `409` illegal moves (deleted-entity
 * mutation and friends) surface as error notifications, never as
 * predicted UI state. Non-deleted categories offer the three forward
 * actions; deleted categories offer `restore` only (data-driven from
 * `isDeleted`, not a transition table).
 *
 * Resource states: the category slot drives the page (loading/error
 * with retry); failures resolve through `resolveApiErrorMessage`
 * (never backend text); successes raise localized notifications.
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
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { CultureService, resolveApiErrorMessage, translateKey } from '@flux/i18n';
import { Badge, type BadgeVariant, Card, ErrorState, LoadingIndicator } from '@flux/ui';
import { isApiError } from '@flux/api';
import type { CategoryLifecycleAction } from '@flux/models';
import { AdminDialog } from '../../../../shared/dialog/dialog';
import { AdminNotificationService } from '../../../../shared/notifications/notification-service';
import { CategoryDetailsState } from '../../state/category-details-state';
import { CategoryLookupState } from '../../state/category-lookup-state';
import { categoryNameOf, categoryStatusDisplay } from '../../models/catalog-admin.models';
import { CATALOG_TRANSLATION_KEYS, translateCatalogKey } from '../../i18n/catalog-translations';

/** Lifecycle actions offered for live categories (order of display). */
const FORWARD_ACTIONS: readonly CategoryLifecycleAction[] = [
  'activate',
  'deactivate',
  'soft-delete',
];

@Component({
  selector: 'app-category-details-page',
  imports: [RouterLink, AdminDialog, Badge, Card, ErrorState, LoadingIndicator],
  templateUrl: './category-details-page.html',
  styleUrl: './category-details-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryDetailsPage implements OnInit {
  private readonly details = inject(CategoryDetailsState);
  private readonly lookup = inject(CategoryLookupState);
  private readonly cultures = inject(CultureService);
  private readonly notifications = inject(AdminNotificationService);

  /** Route category id (`null` until the first param emission). */
  private readonly categoryId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id'))),
    { initialValue: null as string | null },
  );

  /** Pending lifecycle action behind the confirmation dialog (`null` = closed). */
  protected readonly pendingAction = signal<CategoryLifecycleAction | null>(null);

  /** Current category slot (idle → loading → success | empty | error). */
  protected readonly category = this.details.category;

  constructor() {
    // Drives the slot from the route id (initial value included,
    // changes followed). Runs `untracked` so settled responses never
    // reschedule the effect — the id is the only dependency. The
    // lookup loads once alongside (parent display names).
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

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    const record = this.category().data;
    return {
      back: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesBack),
      edit: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesEdit),
      loading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesLoading),
      errorTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesErrorTitle),
      retry: translateKey(culture, 'common.actions.retry'),
      name: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsName),
      slug: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsSlug),
      description: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsDescription),
      status: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsStatus),
      parent: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsParent),
      created: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsCreated),
      deleted: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsDeleted),
      actionsTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsActionsTitle),
      dialogTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.lifecycleConfirmTitle),
      dialogConfirm: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.lifecycleConfirm),
      dialogCancel: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.lifecycleCancel),
      dialogMessage:
        this.pendingAction() === null || record === null
          ? ''
          : translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.lifecycleConfirmMessage, {
              action: translateCatalogKey(
                culture,
                lifecycleVerbKey(this.pendingAction() ?? 'activate'),
              ),
              name: record.name,
            }),
    };
  });

  /** Status badge (label + variant, unknown-safe). */
  protected readonly statusBadge = computed((): { label: string; variant: BadgeVariant } | null => {
    const status = this.category().data?.status;
    if (status === undefined || status === null) {
      return null;
    }
    const display = categoryStatusDisplay(status);
    return {
      label: translateCatalogKey(this.cultures.culture(), display.labelKey, {
        value: String(status),
      }),
      variant: display.variant,
    };
  });

  /** Display parent name (`—` for top-level, raw-id fallback outside the lookup). */
  protected readonly parentName = computed(() => {
    const record = this.category().data;
    if (record === null) {
      return '';
    }
    if (typeof record.parentId !== 'string') {
      return '—';
    }
    return categoryNameOf(this.lookup.categories().data ?? [], record.parentId);
  });

  /** Lifecycle actions for the loaded category (restore-only when deleted). */
  protected readonly actions = computed((): readonly CategoryLifecycleAction[] => {
    const record = this.category().data;
    if (record === null) {
      return [];
    }
    return record.isDeleted ? (['restore'] as const) : FORWARD_ACTIONS;
  });

  /** Localized action button labels for the active culture. */
  protected readonly actionLabels = computed((): Record<CategoryLifecycleAction, string> => {
    const culture = this.cultures.culture();
    return {
      activate: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.lifecycleActivate),
      deactivate: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.lifecycleDeactivate),
      'soft-delete': translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.lifecycleDelete),
      restore: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.lifecycleRestore),
    };
  });

  /** Whether lifecycle buttons lock (transition in flight). */
  protected readonly actionsLocked = this.details.transitionInFlight;

  /** Localized failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.category().error, this.cultures.culture()),
  );

  /** Back link to the category list. */
  protected backLink(): string {
    return '/catalog/categories';
  }

  /** Edit link for the loaded category (`null` until the id emits). */
  protected editLink(): string | null {
    const id = this.categoryId();
    return id === null ? null : `/catalog/categories/${id}/edit`;
  }

  /** Category retry reloads the current id (and refreshes the lookup). */
  protected retry(): void {
    const id = this.categoryId();
    if (id !== null) {
      this.details.load(id);
      this.lookup.load();
    }
  }

  /** Opens the confirmation dialog for `action`. */
  protected requestAction(action: CategoryLifecycleAction): void {
    this.pendingAction.set(action);
  }

  /** Closes the confirmation dialog without acting. */
  protected cancelAction(): void {
    this.pendingAction.set(null);
  }

  /**
   * Confirms the pending action: closes the dialog first (duplicate
   * clicks cannot re-enter), then runs the state transition. Success
   * notifies and the state reloads the category slot; failures notify
   * with the resolved message.
   */
  protected confirmAction(): void {
    const action = this.pendingAction();
    const id = this.categoryId();
    this.pendingAction.set(null);
    if (action === null || id === null) {
      return;
    }
    this.details.transition(id, action)?.subscribe({
      next: () => {
        const culture = this.cultures.culture();
        const name = this.category().data?.name ?? id;
        this.notifications.success(
          translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.lifecycleSuccessTitle),
          translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.lifecycleSuccessMessage, { name }),
        );
      },
      error: (error: unknown) => this.notifyFailure(error),
    });
  }

  private notifyFailure(error: unknown): void {
    const culture = this.cultures.culture();
    const message = isApiError(error)
      ? resolveApiErrorMessage(error, culture)
      : translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.lifecycleFailureTitle);
    this.notifications.error(
      translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.lifecycleFailureTitle),
      message,
    );
  }
}

/** Confirm-message verb key behind one lifecycle action. */
function lifecycleVerbKey(action: CategoryLifecycleAction): string {
  switch (action) {
    case 'activate':
      return CATALOG_TRANSLATION_KEYS.lifecycleVerbActivate;
    case 'deactivate':
      return CATALOG_TRANSLATION_KEYS.lifecycleVerbDeactivate;
    case 'soft-delete':
      return CATALOG_TRANSLATION_KEYS.lifecycleVerbDelete;
    case 'restore':
      return CATALOG_TRANSLATION_KEYS.lifecycleVerbRestore;
  }
}
