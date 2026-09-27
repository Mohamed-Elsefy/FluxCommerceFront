/**
 * Admin product details page for Sub-Phases 13.3–13.6 — Product
 * Management + Images & Specifications.
 *
 * Smart page (route-level composition): reads the feature-scoped
 * `ProductDetailsState` (route-provided `catalogRoutes` entry — never a
 * global store) for the product slot, the variant display section, the
 * image/specification sections (reads plus inline management), and
 * product lifecycle transitions.
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
 * feature (13.9+) — this page performs no inventory reads. Variant
 * MANAGEMENT lives on the dedicated variant slice (13.4); the variants
 * section below stays a read-only display with its management entry
 * point.
 *
 * Image/specification contract (13.6 — only backend-exposed
 * operations): images are URL-based references (confirmed in 13.1 — no
 * file input exists anywhere); add carries `isPrimary`, update carries
 * no primary flag (primary moves through `set-primary` only) and
 * round-trips stored `metadata` untouched (no metadata editor exists —
 * sending `null` would wipe data the UI never showed); reorder commits
 * the exact settled id set with two entries swapped. Specifications
 * are simple `name`/`value` pairs with full CRUD. Every mutation
 * refreshes the settled truth afterwards (data retained across
 * reloads, so no content flashes).
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
 * Dialog submits lock (`mediaBusy`/`specBusy`); `400` field maps
 * project onto their dialog controls, everything else renders as the
 * dialog-level notice; destructive actions confirm; successes notify.
 * Failures resolve through `resolveApiErrorMessage` (never backend
 * text).
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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { CultureService, formatCurrency, resolveApiErrorMessage, translateKey } from '@flux/i18n';
import { Badge, type BadgeVariant, Card, ErrorState, LoadingIndicator } from '@flux/ui';
import { isApiError } from '@flux/api';
import type {
  ProductImageResponse,
  ProductLifecycleAction,
  ProductSpecificationResponse,
  VariantResponse,
} from '@flux/models';
import { AdminDialog } from '../../../../shared/dialog/dialog';
import { AdminDataTable, type AdminDataColumn } from '../../../../shared/data-table/data-table';
import { AdminNotificationService } from '../../../../shared/notifications/notification-service';
import { CatalogAdminApiService } from '../../data-access/catalog-admin-api.service';
import { ProductDetailsState } from '../../state/product-details-state';
import { CategoryLookupState } from '../../state/category-lookup-state';
import {
  categoryNameOf,
  emptyImageFormValue,
  emptySpecFormValue,
  imageToFormValue,
  moveImageIds,
  productStatusDisplay,
  productVisibilityDisplay,
  specToFormValue,
  toAddImageRequest,
  toCreateSpecRequest,
  toUpdateImageRequest,
  toUpdateSpecRequest,
  type ImageFormValue,
  type SpecFormValue,
} from '../../models/catalog-admin.models';
import { ImageForm, type ImageFormCopy } from '../../components/image-form/image-form';
import { SpecForm, type SpecFormCopy } from '../../components/spec-form/spec-form';
import { CATALOG_TRANSLATION_KEYS, translateCatalogKey } from '../../i18n/catalog-translations';

/** Lifecycle actions offered for live products (order of display). */
const FORWARD_ACTIONS: readonly ProductLifecycleAction[] = [
  'activate',
  'deactivate',
  'archive',
  'soft-delete',
];

/** Image dialog state: closed, adding, or editing one settled row. */
type ImageDialog =
  | { readonly open: false }
  | { readonly open: true; readonly mode: 'create' }
  | { readonly open: true; readonly mode: 'edit'; readonly image: ProductImageResponse };

/** Specification dialog state: closed, adding, or editing one settled row. */
type SpecDialog =
  | { readonly open: false }
  | { readonly open: true; readonly mode: 'create' }
  | { readonly open: true; readonly mode: 'edit'; readonly spec: ProductSpecificationResponse };

@Component({
  selector: 'app-product-details-page',
  imports: [
    RouterLink,
    AdminDataTable,
    AdminDialog,
    Badge,
    Card,
    ErrorState,
    ImageForm,
    LoadingIndicator,
    SpecForm,
  ],
  templateUrl: './product-details-page.html',
  styleUrl: './product-details-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailsPage implements OnInit {
  private readonly details = inject(ProductDetailsState);
  private readonly lookup = inject(CategoryLookupState);
  private readonly catalogApi = inject(CatalogAdminApiService);
  private readonly cultures = inject(CultureService);
  private readonly notifications = inject(AdminNotificationService);

  private readonly imageForm = viewChild(ImageForm);
  private readonly specForm = viewChild(SpecForm);

  /** Route product id (`null` until the first param emission). */
  private readonly productId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id'))),
    { initialValue: null as string | null },
  );

  /** Pending lifecycle action behind the confirmation dialog (`null` = closed). */
  protected readonly pendingAction = signal<ProductLifecycleAction | null>(null);

  /** Image add/edit dialog (`open: false` = closed). */
  protected readonly imageDialog = signal<ImageDialog>({ open: false });

  /** Image id behind the delete confirmation (`null` = closed). */
  protected readonly imageDeleting = signal<string | null>(null);

  /** Image operation in flight (dialog submits and row actions lock). */
  protected readonly mediaBusy = signal(false);

  /** Image dialog-level failure notice (`null` when clean). */
  protected readonly imageFormError = signal<string | null>(null);

  /** Specification add/edit dialog (`open: false` = closed). */
  protected readonly specDialog = signal<SpecDialog>({ open: false });

  /** Specification id behind the delete confirmation (`null` = closed). */
  protected readonly specDeleting = signal<string | null>(null);

  /** Specification operation in flight (dialog submits and row actions lock). */
  protected readonly specBusy = signal(false);

  /** Specification dialog-level failure notice (`null` when clean). */
  protected readonly specFormError = signal<string | null>(null);

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
      actionsHeader: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsActionsHeader),
      addImage: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsAddImage),
      addSpec: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsAddSpec),
      imageSetPrimary: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.imageRowSetPrimary),
      imageEdit: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.imageRowEdit),
      imageDelete: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.imageRowDelete),
      imageMoveUp: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.imageRowMoveUp),
      imageMoveDown: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.imageRowMoveDown),
      imageAddTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.imageAddTitle),
      imageEditTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.imageEditTitle),
      imageFormErrorTitle: translateCatalogKey(
        culture,
        CATALOG_TRANSLATION_KEYS.imageFormErrorTitle,
      ),
      imageDeleteTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.imageDeleteTitle),
      imageDeleteMessage: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.imageDeleteMessage),
      specEdit: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.specRowEdit),
      specDelete: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.specRowDelete),
      specAddTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.specAddTitle),
      specEditTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.specEditTitle),
      specFormErrorTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.specFormErrorTitle),
      specDeleteTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.specDeleteTitle),
      specDeleteMessage: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.specDeleteMessage, {
        name: this.specDeletingName(),
      }),
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

  /** Localized image form copy for the active culture. */
  protected readonly imageFormCopy = computed((): ImageFormCopy => {
    const culture = this.cultures.culture();
    const dialog = this.imageDialog();
    return {
      url: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.imageFormUrl),
      urlHint: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.imageFormUrlHint),
      altText: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.imageFormAlt),
      order: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.imageFormOrder),
      primary: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.imageFormPrimary),
      submit:
        dialog.open && dialog.mode === 'create'
          ? translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.imageFormAdd)
          : translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.imageFormSave),
      cancel: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.imageFormCancel),
      saving: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.imageFormSaving),
    };
  });

  /** Whether the image dialog is open. */
  protected readonly imageDialogOpen = computed(() => this.imageDialog().open);

  /** Image dialog mode (`create` unless an edit row is bound). */
  protected readonly imageDialogMode = computed((): 'create' | 'edit' => {
    const dialog = this.imageDialog();
    return dialog.open && dialog.mode === 'edit' ? 'edit' : 'create';
  });

  /** Image dialog initial value (blank on add, row snapshot on edit). */
  protected readonly imageInitial = computed((): ImageFormValue => {
    const dialog = this.imageDialog();
    if (dialog.open && dialog.mode === 'edit') {
      return imageToFormValue(dialog.image);
    }
    return emptyImageFormValue();
  });

  /** Localized specification form copy for the active culture. */
  protected readonly specFormCopy = computed((): SpecFormCopy => {
    const culture = this.cultures.culture();
    const dialog = this.specDialog();
    return {
      name: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.specFormName),
      value: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.specFormValue),
      submit:
        dialog.open && dialog.mode === 'create'
          ? translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.specFormAdd)
          : translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.specFormSave),
      cancel: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.specFormCancel),
      saving: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.specFormSaving),
    };
  });

  /** Whether the specification dialog is open. */
  protected readonly specDialogOpen = computed(() => this.specDialog().open);

  /** Specification dialog mode (`create` unless an edit row is bound). */
  protected readonly specDialogMode = computed((): 'create' | 'edit' => {
    const dialog = this.specDialog();
    return dialog.open && dialog.mode === 'edit' ? 'edit' : 'create';
  });

  /** Specification dialog initial value (blank on add, row snapshot on edit). */
  protected readonly specInitial = computed((): SpecFormValue => {
    const dialog = this.specDialog();
    if (dialog.open && dialog.mode === 'edit') {
      return specToFormValue(dialog.spec);
    }
    return emptySpecFormValue();
  });

  /** Name behind the specification delete confirmation (for its message). */
  private readonly specDeletingName = computed(() => {
    const id = this.specDeleting();
    if (id === null) {
      return '';
    }
    return this.specifications().data?.find((spec) => spec.id === id)?.name ?? '';
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

  /** Specification table columns for the active culture. */
  protected readonly specColumns = computed(
    (): readonly AdminDataColumn<ProductSpecificationResponse>[] => {
      const culture = this.cultures.culture();
      return [
        {
          key: 'name',
          header: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsColSpecName),
          value: (row) => row.name,
        },
        {
          key: 'value',
          header: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.detailsColSpecValue),
          value: (row) => row.value,
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
    this.refreshSections();
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

  // -------------------------------------------------------------------------
  // Image management (13.6)
  // -------------------------------------------------------------------------

  /** Opens the image add dialog. */
  protected openAddImage(): void {
    this.imageFormError.set(null);
    this.imageDialog.set({ open: true, mode: 'create' });
  }

  /** Opens the image edit dialog for one settled row. */
  protected openEditImage(image: ProductImageResponse): void {
    this.imageFormError.set(null);
    this.imageDialog.set({ open: true, mode: 'edit', image });
  }

  /** Closes the image dialog without acting. */
  protected closeImageDialog(): void {
    this.imageDialog.set({ open: false });
  }

  /**
   * Submits the image dialog value: add on create mode, update (with
   * stored-metadata round-tripping) on edit mode. Re-entrant calls
   * while an operation is in flight are no-ops.
   */
  protected saveImage(value: ImageFormValue): void {
    const dialog = this.imageDialog();
    const id = this.productId();
    if (!dialog.open || id === null || this.mediaBusy()) {
      return;
    }
    this.mediaBusy.set(true);
    this.imageFormError.set(null);
    this.imageForm()?.clearServerErrors();
    const done = (titleKey: string): void => {
      this.mediaBusy.set(false);
      this.imageDialog.set({ open: false });
      this.notifications.success(translateCatalogKey(this.cultures.culture(), titleKey), '');
      this.refreshSections();
    };
    const failed = (error: unknown): void => {
      this.mediaBusy.set(false);
      this.applyImageErrors(error);
    };
    if (dialog.mode === 'create') {
      this.catalogApi.addProductImage(id, toAddImageRequest(value)).subscribe({
        next: () => done(CATALOG_TRANSLATION_KEYS.imageAddedTitle),
        error: failed,
      });
    } else {
      this.catalogApi
        .updateProductImage(id, dialog.image.id, toUpdateImageRequest(value, dialog.image))
        .subscribe({
          next: () => done(CATALOG_TRANSLATION_KEYS.imageUpdatedTitle),
          error: failed,
        });
    }
  }

  /** Opens the image delete confirmation for one settled row. */
  protected requestDeleteImage(imageId: string): void {
    this.imageDeleting.set(imageId);
  }

  /** Closes the image delete confirmation without acting. */
  protected cancelDeleteImage(): void {
    this.imageDeleting.set(null);
  }

  /**
   * Confirms image deletion: closes the dialog first, then runs the
   * backend call under the shared media lock. Success notifies and
   * refreshes; failures notify with the resolved message.
   */
  protected confirmDeleteImage(): void {
    const imageId = this.imageDeleting();
    const id = this.productId();
    this.imageDeleting.set(null);
    if (imageId === null || id === null || this.mediaBusy()) {
      return;
    }
    this.mediaBusy.set(true);
    this.catalogApi.deleteProductImage(id, imageId).subscribe({
      next: () => {
        this.mediaBusy.set(false);
        this.notifications.success(
          translateCatalogKey(this.cultures.culture(), CATALOG_TRANSLATION_KEYS.imageDeletedTitle),
          '',
        );
        this.refreshSections();
      },
      error: (error: unknown) => {
        this.mediaBusy.set(false);
        this.notifyMediaFailure(error);
      },
    });
  }

  /**
   * Marks one image primary (idempotent — already-primary rows no-op
   * locally without traffic). Shares the media lock with the other
   * image operations.
   */
  protected setPrimary(image: ProductImageResponse): void {
    const id = this.productId();
    if (id === null || this.mediaBusy() || image.isPrimary) {
      return;
    }
    this.mediaBusy.set(true);
    this.catalogApi.setPrimaryImage(id, image.id).subscribe({
      next: () => {
        this.mediaBusy.set(false);
        this.notifications.success(
          translateCatalogKey(this.cultures.culture(), CATALOG_TRANSLATION_KEYS.imagePrimaryTitle),
          '',
        );
        this.refreshSections();
      },
      error: (error: unknown) => {
        this.mediaBusy.set(false);
        this.notifyMediaFailure(error);
      },
    });
  }

  /**
   * Moves one image entry and commits the exact settled id set with
   * two entries swapped (the backend rejects anything else, so the
   * order derives from settled data only). Boundary moves no-op
   * locally without traffic.
   */
  protected moveImage(image: ProductImageResponse, direction: -1 | 1): void {
    const id = this.productId();
    const items = this.images().data;
    if (id === null || items === null || this.mediaBusy()) {
      return;
    }
    const ids = items.map((item) => item.id);
    const next = moveImageIds(ids, ids.indexOf(image.id), direction);
    if (next.join() === ids.join()) {
      return;
    }
    this.mediaBusy.set(true);
    this.catalogApi.reorderProductImages(id, { orderedImageIds: next }).subscribe({
      next: () => {
        this.mediaBusy.set(false);
        this.notifications.success(
          translateCatalogKey(
            this.cultures.culture(),
            CATALOG_TRANSLATION_KEYS.imageReorderedTitle,
          ),
          '',
        );
        this.refreshSections();
      },
      error: (error: unknown) => {
        this.mediaBusy.set(false);
        this.notifyMediaFailure(error);
      },
    });
  }

  private applyImageErrors(error: unknown): void {
    if (isApiError(error) && error.status === 400 && error.validationErrors !== undefined) {
      const unknown = this.imageForm()?.applyServerErrors(error.validationErrors) ?? [];
      if (unknown.length === 0) {
        return;
      }
    }
    const culture = this.cultures.culture();
    this.imageFormError.set(
      isApiError(error)
        ? resolveApiErrorMessage(error, culture)
        : translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.imageFormErrorTitle),
    );
  }

  private notifyMediaFailure(error: unknown): void {
    const culture = this.cultures.culture();
    this.notifications.error(
      translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.imageFailureTitle),
      isApiError(error)
        ? resolveApiErrorMessage(error, culture)
        : translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.imageFailureTitle),
    );
  }

  // -------------------------------------------------------------------------
  // Specification management (13.6)
  // -------------------------------------------------------------------------

  /** Opens the specification add dialog. */
  protected openAddSpec(): void {
    this.specFormError.set(null);
    this.specDialog.set({ open: true, mode: 'create' });
  }

  /** Opens the specification edit dialog for one settled row. */
  protected openEditSpec(spec: ProductSpecificationResponse): void {
    this.specFormError.set(null);
    this.specDialog.set({ open: true, mode: 'edit', spec });
  }

  /** Closes the specification dialog without acting. */
  protected closeSpecDialog(): void {
    this.specDialog.set({ open: false });
  }

  /**
   * Submits the specification dialog value: create on add mode, update
   * on edit mode. Re-entrant calls while an operation is in flight are
   * no-ops.
   */
  protected saveSpec(value: SpecFormValue): void {
    const dialog = this.specDialog();
    const id = this.productId();
    if (!dialog.open || id === null || this.specBusy()) {
      return;
    }
    this.specBusy.set(true);
    this.specFormError.set(null);
    this.specForm()?.clearServerErrors();
    const done = (titleKey: string): void => {
      this.specBusy.set(false);
      this.specDialog.set({ open: false });
      this.notifications.success(translateCatalogKey(this.cultures.culture(), titleKey), '');
      this.refreshSections();
    };
    const failed = (error: unknown): void => {
      this.specBusy.set(false);
      if (isApiError(error) && error.status === 400 && error.validationErrors !== undefined) {
        const unknown = this.specForm()?.applyServerErrors(error.validationErrors) ?? [];
        if (unknown.length === 0) {
          return;
        }
      }
      const culture = this.cultures.culture();
      this.specFormError.set(
        isApiError(error)
          ? resolveApiErrorMessage(error, culture)
          : translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.specFormErrorTitle),
      );
    };
    if (dialog.mode === 'create') {
      this.catalogApi.createSpecification(id, toCreateSpecRequest(value)).subscribe({
        next: () => done(CATALOG_TRANSLATION_KEYS.specAddedTitle),
        error: failed,
      });
    } else {
      this.catalogApi
        .updateSpecification(id, dialog.spec.id, toUpdateSpecRequest(value))
        .subscribe({
          next: () => done(CATALOG_TRANSLATION_KEYS.specUpdatedTitle),
          error: failed,
        });
    }
  }

  /** Opens the specification delete confirmation for one settled row. */
  protected requestDeleteSpec(specId: string): void {
    this.specDeleting.set(specId);
  }

  /** Closes the specification delete confirmation without acting. */
  protected cancelDeleteSpec(): void {
    this.specDeleting.set(null);
  }

  /**
   * Confirms specification deletion: closes the dialog first, then runs
   * the backend call under the shared spec lock. Success notifies and
   * refreshes; failures notify with the resolved message.
   */
  protected confirmDeleteSpec(): void {
    const specId = this.specDeleting();
    const id = this.productId();
    this.specDeleting.set(null);
    if (specId === null || id === null || this.specBusy()) {
      return;
    }
    this.specBusy.set(true);
    this.catalogApi.deleteSpecification(id, specId).subscribe({
      next: () => {
        this.specBusy.set(false);
        this.notifications.success(
          translateCatalogKey(this.cultures.culture(), CATALOG_TRANSLATION_KEYS.specDeletedTitle),
          '',
        );
        this.refreshSections();
      },
      error: (error: unknown) => {
        this.specBusy.set(false);
        const culture = this.cultures.culture();
        this.notifications.error(
          translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.specFailureTitle),
          isApiError(error)
            ? resolveApiErrorMessage(error, culture)
            : translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.specFailureTitle),
        );
      },
    });
  }

  /** Reloads every slot for the current id (post-mutation refresh). */
  private refreshSections(): void {
    const id = this.productId();
    if (id !== null) {
      this.details.load(id);
    }
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
