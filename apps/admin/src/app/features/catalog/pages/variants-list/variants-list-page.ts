/**
 * Admin variant list page for Sub-Phase 13.4 — Product Variants
 * Management.
 *
 * Smart page (route-level composition) within the product context
 * (`/catalog/products/:productId/variants`): reads the feature-scoped
 * `VariantListState` (route-provided `catalogRoutes` entry — never a
 * global store) and renders the full variant collection through the
 * shared admin table. No pager exists by design: the backend returns
 * the whole collection at once (no pagination contract).
 *
 * Display contract (13.1 audit — only backend-exposed data): SKU
 * (linked to variant details), name, backend-issued price (display
 * only, via `formatCurrency` — never an input to math), and status as
 * localized text with the forward-compatible unknown fallback.
 * Availability/stock display belongs to the Inventory feature (13.9+) —
 * this page performs no inventory reads. Variant removal runs from the
 * variant details page (the shared table owns no row actions).
 *
 * Resource states: idle → loading → success | empty | error through the
 * shared primitives with localized copy and retry. Failures resolve
 * through `resolveApiErrorMessage` (never backend text).
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
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { CultureService, formatCurrency, resolveApiErrorMessage, translateKey } from '@flux/i18n';
import { ErrorState } from '@flux/ui';
import { AdminDataTable, type AdminDataColumn } from '../../../../shared/data-table/data-table';
import { VariantListState } from '../../state/variant-list-state';
import { variantStatusDisplay, type AdminVariantRow } from '../../models/catalog-admin.models';
import { CATALOG_TRANSLATION_KEYS, translateCatalogKey } from '../../i18n/catalog-translations';

@Component({
  selector: 'app-variants-list-page',
  imports: [RouterLink, AdminDataTable, ErrorState],
  templateUrl: './variants-list-page.html',
  styleUrl: './variants-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VariantsListPage {
  private readonly variants = inject(VariantListState);
  private readonly cultures = inject(CultureService);

  /** Route product id (`null` until the first param emission). */
  private readonly productId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('productId'))),
    { initialValue: null as string | null },
  );

  /** Current variant collection (idle → loading → success | empty | error). */
  protected readonly slot = this.variants.variants;

  constructor() {
    // Drives the collection from the route product id (initial value
    // included, changes followed). Runs `untracked` so settled
    // responses never reschedule the effect — the id is the only
    // dependency.
    effect(() => {
      const productId = this.productId();
      untracked(() => {
        if (productId !== null) {
          this.variants.load(productId);
        }
      });
    });
  }

  /** Whether the table body shows the loading state. */
  protected readonly tableLoading = computed(() => {
    const status = this.slot().status;
    return status === 'idle' || status === 'loading';
  });

  /** Localized table columns for the active culture. */
  protected readonly columns = computed((): readonly AdminDataColumn<AdminVariantRow>[] => {
    const culture = this.cultures.culture();
    const productId = this.productId();
    return [
      {
        key: 'sku',
        header: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantsColSku),
        value: (row) => row.sku,
        link: (row) =>
          productId === null ? null : `/catalog/products/${productId}/variants/${row.id}`,
      },
      {
        key: 'name',
        header: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantsColName),
        value: (row) => row.name,
      },
      {
        key: 'price',
        header: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantsColPrice),
        value: (row) => formatCurrency(row.unitPriceAmount, row.currency, culture),
      },
      {
        key: 'status',
        header: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantsColStatus),
        value: (row) => this.statusText(row.status),
      },
    ];
  });

  /** Current collection rows (`[]` until settled). */
  protected readonly rows = computed(() => this.slot().data ?? []);

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      heading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantsHeading),
      subheading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantsSubheading),
      new: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantsNew),
      back: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantsBack),
      caption: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantsCaption),
      loading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantsLoading),
      emptyTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantsEmptyTitle),
      emptyMessage: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantsEmptyMessage),
      errorTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.variantsErrorTitle),
      retry: translateKey(culture, 'common.actions.retry'),
    };
  });

  /** Localized failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.slot().error, this.cultures.culture()),
  );

  /** Back link to the owning product (`null` until the id emits). */
  protected backLink(): string | null {
    const productId = this.productId();
    return productId === null ? null : `/catalog/products/${productId}`;
  }

  /** Collection retry reloads the current product scope. */
  protected retry(): void {
    const productId = this.productId();
    if (productId !== null) {
      this.variants.load(productId);
    }
  }

  /** Localized status text with the forward-compatible unknown fallback. */
  private statusText(status: AdminVariantRow['status']): string {
    const culture = this.cultures.culture();
    const display = variantStatusDisplay(status);
    return translateCatalogKey(culture, display.labelKey, { value: String(status) });
  }
}
