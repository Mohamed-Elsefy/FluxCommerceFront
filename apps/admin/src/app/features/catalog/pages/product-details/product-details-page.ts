/**
 * Admin product details page for Sub-Phase 13.3 — Product Management.
 *
 * Smart page (route-level composition): reads the feature-scoped
 * `ProductDetailsState` (route-provided `catalogRoutes` entry — never a
 * global store) for the product slot, the three read-only display
 * sections (variants, images, specifications), and lifecycle transitions.
 *
 * Data flow (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * ProductDetailsPage (this file — orchestration only)
 *     ↓ ProductDetailsState (../state — slots + transition lock)
 *     ↓ CatalogAdminApiService (../data-access — feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Catalog API
 * ```
 *
 * Display contract (13.1 audit — only backend-exposed data):
 * metadata (name, slug, description, status, visibility, category,
 * SEO, timestamps) plus the variant/image/specification reads. Prices
 * echo verbatim for display only (never inputs to math, via
 * `formatCurrency`). Availability/stock display belongs to the Inventory
 * feature (13.9+) — this page performs no inventory reads. Variant,
 * image, and specification MANAGEMENT (create/edit/delete) arrives with
 * Sub-Phases 13.4–13.6; the sections below stay read-only with localized
 * empty states until then.
 *
 * Lifecycle contract: every supported transition (`activate`,
 * `deactivate`, `archive`, `soft-delete`, `restore`) runs behind a
 * confirmation dialog with duplicate-submit prevention (state lock +
 * dialog dismissal on confirm). The backend owns transition validity —
 * `409` illegal moves surface as error notifications, never as
 * predicted UI state. Non-deleted products offer the four forward
 * actions; deleted products offer `restore` only (data-driven from
 * `isDeleted`, not a transition table).
 *
 * Resource states: the product slot drives the header (loading/error
 * with retry); every section renders its own slot states independently.
 * Failures resolve through `resolveApiErrorMessage` (never backend
 * text); successes raise localized notifications.
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
import { CultureService, formatCurrency, resolveApiErrorMessage, translateKey } from '@flux/i18n';
import { Badge, type BadgeVariant, Card, EmptyState, ErrorState, LoadingIndicator } from '@flux/ui';
import { isApiError } from '@flux/api';
import type { ProductImageResponse, ProductLifecycleAction, VariantResponse } from '@flux/models';
import { AdminDialog } from '../../../../shared/dialog/dialog';
import { AdminDataTable, type AdminDataColumn } from '../../../../shared/data-table/data-table';
import { AdminNotificationService } from '../../../../shared/notifications/notification-service';
import { ProductDetailsState } from '../../state/product-details-state';
import { CategoryLookupState } from '../../state/category-lookup-state';
import {
  categoryNameOf,
  productStatusDisplay,
  productVisibilityDisplay,
} from '../../models/catalog-admin.models';
import { CATALOG_TRANSLATION_KEYS, translateCatalogKey } from '../../i18n/catalog-translations';

/** Lifecycle actions offered for live products (order of display). */
const FORWARD_ACTIONS: readonly ProductLifecycleAction[] = [
  'activate',
  'deactivate',
  'archive',
  'soft-delete',
];

@Component({
  selector: 'app-product-details-page',
  imports: [
    RouterLink,
    AdminDataTable,
    AdminDialog,
    Badge,
    Card,
    EmptyState,
    ErrorState,
    LoadingIndicator,
  ],
  templateUrl: './product-details-page.html',
  styleUrl: './product-details-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailsPage implements OnInit {
  private readonly details = inject(ProductDetailsState);
  private readonly lookup = inject(CategoryLookupState);
  private readonly cultures = inject(CultureService);
  private readonly notifications = inject(AdminNotificationService);

  /** Route product id (`null` until the first param emission). */
  private readonly productId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id'))),
    { initialValue: null as string | null },
  );

  /** Pending lifecycle action behind the confirmation dialog (`null` = closed). */
  protected readonly pendingAction = signal<ProductLifecycleAction | null>(null);

  /** Current product slot (idle → loading → success | empty | error). */
  protected readonly product = this.details.product;

  constructor() {
    // Drives every slot from the route id (initial value included,
    // changes followed). Runs `untracked` on purpose: loads read and
    // write the slots, so without `untracked` every settled response
    // would reschedule the effect into an infinite fetch loop. The
    // effect depends on the route id alone.
    effect(() => {
      const id = this.productId();
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

  /** Localized header and metadata copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    const product = this.product().data;
    return {
      back: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsBack),
      edit: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsEdit),
      loading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsSectionLoading),
      errorTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listErrorTitle),
      retry: translateKey(culture, 'common.actions.retry'),
      name: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsName),
      slug: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsSlug),
      description: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsDescription),
      status: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsStatus),
      visibility: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsVisibility),
      category: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsCategory),
      created: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsCreated),
      deleted: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsDeleted),
      actionsTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsActionsTitle),
      variantsTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsVariantsTitle),
      manageVariants: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsManageVariants),
      imagesTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsImagesTitle),
      specsTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsSpecsTitle),
      sectionLoading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsSectionLoading),
      sectionError: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsSectionError),
      variantsEmpty: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsVariantsEmpty),
      imagesEmpty: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsImagesEmpty),
      specsEmpty: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsSpecsEmpty),
      dialogTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.lifecycleConfirmTitle),
      dialogConfirm: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.lifecycleConfirm),
      dialogCancel: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.lifecycleCancel),
      dialogMessage:
        this.pendingAction() === null || product === null
          ? ''
          : translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.lifecycleConfirmMessage, {
              action: translateCatalogKey(
                culture,
                lifecycleVerbKey(this.pendingAction() ?? 'activate'),
              ),
              name: product.name,
            }),
    };
  });

  /** Status badge (label + variant, unknown-safe). */
  protected readonly statusBadge = computed((): { label: string; variant: BadgeVariant } | null => {
    const status = this.product().data?.status;
    if (status === undefined || status === null) {
      return null;
    }
    const display = productStatusDisplay(status);
    return {
      label: translateCatalogKey(this.cultures.culture(), display.labelKey, {
        value: String(status),
      }),
      variant: display.variant,
    };
  });

  /** Visibility badge (label + variant, unknown-safe). */
  protected readonly visibilityBadge = computed(
    (): {
      label: string;
      variant: BadgeVariant;
    } | null => {
      const visibility = this.product().data?.visibility;
      if (visibility === undefined || visibility === null) {
        return null;
      }
      const display = productVisibilityDisplay(visibility);
      return {
        label: translateCatalogKey(this.cultures.culture(), display.labelKey, {
          value: String(visibility),
        }),
        variant: display.variant,
      };
    },
  );

  /** Display category name (raw-id fallback outside the lookup). */
  protected readonly categoryName = computed(() => {
    const product = this.product().data;
    if (product === null) {
      return '';
    }
    return categoryNameOf(this.lookup.categories().data ?? [], product.categoryId);
  });

  /** Lifecycle actions for the loaded product (restore-only when deleted). */
  protected readonly actions = computed((): readonly ProductLifecycleAction[] => {
    const product = this.product().data;
    if (product === null) {
      return [];
    }
    return product.isDeleted ? (['restore'] as const) : FORWARD_ACTIONS;
  });

  /** Localized action button labels for the active culture. */
  protected readonly actionLabels = computed((): Record<ProductLifecycleAction, string> => {
    const culture = this.cultures.culture();
    return {
      activate: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.lifecycleActivate),
      deactivate: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.lifecycleDeactivate),
      archive: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.lifecycleArchive),
      'soft-delete': translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.lifecycleDelete),
      restore: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.lifecycleRestore),
    };
  });

  /** Whether lifecycle buttons lock (transition in flight). */
  protected readonly actionsLocked = this.details.transitionInFlight;

  /** Variant table columns for the active culture. */
  protected readonly variantColumns = computed((): readonly AdminDataColumn<VariantResponse>[] => {
    const culture = this.cultures.culture();
    return [
      {
        key: 'sku',
        header: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsColSku),
        value: (row) => row.sku,
      },
      {
        key: 'name',
        header: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsColVariantName),
        value: (row) => row.name,
      },
      {
        key: 'price',
        header: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsColPrice),
        value: (row) => formatCurrency(row.unitPriceAmount, row.currency, culture),
      },
    ];
  });

  /** Image table columns for the active culture. */
  protected readonly imageColumns = computed(
    (): readonly AdminDataColumn<ProductImageResponse>[] => {
      const culture = this.cultures.culture();
      const yes = translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsYes);
      const no = translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsNo);
      return [
        {
          key: 'image',
          header: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsColImage),
          value: (row) => row.imageUrl,
        },
        {
          key: 'alt',
          header: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsColAlt),
          value: (row) => row.altText ?? '',
        },
        {
          key: 'primary',
          header: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsColPrimary),
          value: (row) => (row.isPrimary ? yes : no),
        },
        {
          key: 'order',
          header: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsColOrder),
          value: (row) => String(row.displayOrder),
        },
      ];
    },
  );

  /** Localized failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.product().error, this.cultures.culture()),
  );

  /** Section failure messages (never backend text). */
  protected readonly variantsError = computed(() =>
    resolveApiErrorMessage(this.details.variants().error, this.cultures.culture()),
  );
  protected readonly imagesError = computed(() =>
    resolveApiErrorMessage(this.details.images().error, this.cultures.culture()),
  );
  protected readonly specsError = computed(() =>
    resolveApiErrorMessage(this.details.specifications().error, this.cultures.culture()),
  );

  /** Section slots for template branching. */
  protected readonly variants = this.details.variants;
  protected readonly images = this.details.images;
  protected readonly specifications = this.details.specifications;

  /** Opens the confirmation dialog for `action`. */
  protected requestAction(action: ProductLifecycleAction): void {
    this.pendingAction.set(action);
  }

  /** Closes the confirmation dialog without acting. */
  protected cancelAction(): void {
    this.pendingAction.set(null);
  }

  /**
   * Confirms the pending action: closes the dialog first (duplicate
   * clicks cannot re-enter), then runs the state transition. Success
   * notifies and the state reloads the product slot; failures notify
   * with the resolved message.
   */
  protected confirmAction(): void {
    const action = this.pendingAction();
    const id = this.productId();
    this.pendingAction.set(null);
    if (action === null || id === null) {
      return;
    }
    this.details.transition(id, action)?.subscribe({
      next: () => {
        const culture = this.cultures.culture();
        const name = this.product().data?.name ?? id;
        this.notifications.success(
          translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.lifecycleSuccessTitle),
          translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.lifecycleSuccessMessage, { name }),
        );
      },
      error: (error: unknown) => this.notifyFailure(error),
    });
  }

  /** Section retry reloads every slot for the current id. */
  protected retry(): void {
    const id = this.productId();
    if (id !== null) {
      this.details.load(id);
    }
  }

  /** Edit navigation for the loaded product. */
  protected editLink(): string | null {
    const id = this.productId();
    return id === null ? null : `/catalog/products/${id}/edit`;
  }

  /** Variant management entry for the loaded product. */
  protected manageVariantsLink(): string | null {
    const id = this.productId();
    return id === null ? null : `/catalog/products/${id}/variants`;
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
function lifecycleVerbKey(action: ProductLifecycleAction): string {
  switch (action) {
    case 'activate':
      return CATALOG_TRANSLATION_KEYS.lifecycleVerbActivate;
    case 'deactivate':
      return CATALOG_TRANSLATION_KEYS.lifecycleVerbDeactivate;
    case 'archive':
      return CATALOG_TRANSLATION_KEYS.lifecycleVerbArchive;
    case 'soft-delete':
      return CATALOG_TRANSLATION_KEYS.lifecycleVerbDelete;
    case 'restore':
      return CATALOG_TRANSLATION_KEYS.lifecycleVerbRestore;
  }
}
