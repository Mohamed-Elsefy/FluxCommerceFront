/**
 * Category navigation component for Sub-Phase 5.2 — Home & Category
 * Discovery.
 *
 * Presentation only: renders HOW category discovery looks (a labelled nav
 * list of category links). The owning page decides WHEN and WHAT —
 * categories, the active selection, and the accessible landmark name arrive
 * as inputs; navigation targets the Catalog listing route
 * (`/catalog?categoryId=<id>`, consumed by the Sub-Phase 5.3 listing page).
 * No API access, no state, no HTTP — presentational components never call
 * the Catalog API (`ARCHITECTURE.md` §8).
 *
 * The active category (mirrored from the `categoryId` query parameter by
 * the owning page) is exposed via `aria-current` so assistive technology
 * announces the selection. Category descriptions render as supporting text
 * when the backend provides them.
 *
 * SSR/hydration safe: static markup from inputs only, no browser APIs.
 * RTL safe: logical properties only, no direction branching.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Category } from '../../models/catalog.models';

@Component({
  selector: 'catalog-category-nav',
  imports: [RouterLink],
  templateUrl: './category-nav.html',
  styleUrl: './category-nav.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryNav {
  /** Categories to render (feature-loaded, already ordered by the backend). */
  @Input({ required: true }) categories: readonly Category[] = [];

  /**
   * Currently selected category id (mirrored from the `categoryId` query
   * parameter by the owning page). Marks the matching link with
   * `aria-current`; `null` selects nothing.
   */
  @Input() activeCategoryId: string | null = null;

  /** Accessible landmark name for the nav (page-localized, required). */
  @Input({ required: true }) label!: string;

  /**
   * Listing base path category links target (`/catalog` for discovery,
   * `/products` for the shelf). Query keys stay identical — only the
   * base differs, so deep links keep working on both surfaces.
   */
  @Input() basePath = '/catalog';
}
