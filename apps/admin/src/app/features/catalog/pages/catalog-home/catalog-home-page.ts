/**
 * Admin Catalog landing page for Sub-Phase 13.2 — Admin Catalog Feature
 * Foundation.
 *
 * Smart page (route-level composition): reads the feature-scoped
 * `CatalogOverviewState` (provided by the `catalogRoutes` entry — never a
 * global store) and renders the catalog overview — two section cards with
 * backend-issued totals — through the shared `@flux/ui` async primitives.
 *
 * Data flow (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * CatalogHomePage (this file — orchestration only)
 *     ↓ CatalogOverviewState (../state — feature-owned, local Signals)
 *     ↓ CatalogAdminApiService (../data-access — feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Catalog API
 * ```
 *
 * Resource states: idle → loading → success | empty | error through the
 * shared primitives with localized copy and retry. Facts echo the backend
 * `totalCount` values verbatim (culture-formatted for display only — never
 * inputs to math). Failures resolve through `resolveApiErrorMessage`
 * (never backend text). Section cards stay non-interactive: product and
 * category management routes do not exist yet (Sub-Phases 13.3/13.5), so
 * no links ship with the foundation.
 *
 * Copy is localized per the active `CultureService.culture()`: feature
 * copy through the catalog bundle, retry through
 * `common.actions.retry`.
 *
 * SSR/hydration safe: signals plus metadata-free markup, no browser APIs.
 * RTL safe: grid auto-flow follows the document direction; logical
 * properties only.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 13.3–13.6 — no tables, pagination, filters, forms, dialogs, or
 *   management navigation.
 */

import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { CultureService, formatNumber, resolveApiErrorMessage, translateKey } from '@flux/i18n';
import { EmptyState, ErrorState, LoadingIndicator } from '@flux/ui';
import { CatalogSectionCard } from '../../components/section-card/section-card';
import { CatalogOverviewState } from '../../state/catalog-overview-state';
import { CATALOG_TRANSLATION_KEYS, translateCatalogKey } from '../../i18n/catalog-translations';

@Component({
  selector: 'app-catalog-home-page',
  imports: [CatalogSectionCard, EmptyState, ErrorState, LoadingIndicator],
  templateUrl: './catalog-home-page.html',
  styleUrl: './catalog-home-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogHomePage implements OnInit {
  private readonly overview = inject(CatalogOverviewState);
  private readonly cultures = inject(CultureService);

  /** Combined landing status (idle → loading → success | empty | error). */
  protected readonly status = this.overview.status;

  /** Localized page and section copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    const data = this.overview.overview();
    return {
      title: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.title),
      subtitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.subtitle),
      productsTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.productsTitle),
      productsDescription: translateCatalogKey(
        culture,
        CATALOG_TRANSLATION_KEYS.productsDescription,
      ),
      productsFact: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.productsTotal, {
        count: formatNumber(data?.productTotal ?? 0, culture),
      }),
      categoriesTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesTitle),
      categoriesDescription: translateCatalogKey(
        culture,
        CATALOG_TRANSLATION_KEYS.categoriesDescription,
      ),
      categoriesFact: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesTotal, {
        count: formatNumber(data?.categoryTotal ?? 0, culture),
      }),
      loading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.loading),
      errorTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.errorTitle),
      emptyTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.emptyTitle),
      emptyMessage: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.emptyMessage),
      retry: translateKey(culture, 'common.actions.retry'),
    };
  });

  /** Localized failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.overview.error(), this.cultures.culture()),
  );

  ngOnInit(): void {
    this.overview.refresh();
  }

  /** Landing retry re-enters the state refresh (duplicate-safe by design). */
  protected retry(): void {
    this.overview.refresh();
  }
}
