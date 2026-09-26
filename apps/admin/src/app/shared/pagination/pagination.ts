/**
 * Admin pagination control for Sub-Phase 12.5 — Admin Table & Pagination
 * Primitives.
 *
 * Presentation only: renders HOW page navigation looks (First, Previous,
 * numbered pages, Next, Last) for a backend `PagedResult`. The owning
 * feature decides WHEN and WHAT — effective page, page size, and total
 * count arrive as inputs (always from the RESPONSE envelope, never
 * request values, per the pagination contract); committed pages leave
 * through `pageChange`. No API access, no state, no HTTP, no timers.
 *
 * Reuses the Phase 1 pagination infrastructure instead of duplicating
 * it: page counts and boundaries come from `totalPagesOf` (`libs/api`).
 * Page-size selection UI is intentionally absent: choosing a size is a
 * form control that arrives with the Sub-Phase 12.6 primitives — the
 * size travels as an input so features already control it.
 *
 * Hidden entirely for single-page results (nothing to navigate). Native
 * buttons carry disabled states at the boundaries; the current page is
 * marked `aria-current` and disabled. Copy arrives as one object input
 * (owner-localized). SSR/hydration safe: static markup from inputs only,
 * no browser APIs. RTL safe: logical properties only, no direction
 * branching.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { totalPagesOf } from '@flux/api';

/** Localized pager copy (single owner-provided object input). */
export interface AdminPaginationCopy {
  /** Accessible landmark name for the nav. */
  readonly label: string;
  readonly first: string;
  readonly previous: string;
  readonly next: string;
  readonly last: string;
}

/** Maximum numbered buttons shown (sliding window around the current page). */
const MAX_VISIBLE_PAGES = 5;

@Component({
  selector: 'admin-pagination',
  templateUrl: './pagination.html',
  styleUrl: './pagination.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPagination {
  /**
   * Effective page number from the RESPONSE envelope (`pageNumber` echoes
   * backend-resolved values — never render request values here).
   */
  @Input({ required: true }) page = 1;

  /** Effective page size from the RESPONSE envelope. */
  @Input({ required: true }) pageSize = 20;

  /** Total matches across all pages (never page-relative). */
  @Input({ required: true }) totalCount = 0;

  /** Localized copy (owner-provided, required). */
  @Input({ required: true }) copy!: AdminPaginationCopy;

  /** Emitted with the chosen page (guarded: never the current one). */
  @Output() readonly pageChange = new EventEmitter<number>();

  /** Client-side page count (the backend sends no `totalPages`). */
  protected totalPages(): number {
    return totalPagesOf({
      items: [],
      totalCount: this.totalCount,
      pageNumber: this.page,
      pageSize: this.pageSize,
    });
  }

  /** Sliding window of page numbers around the current page. */
  protected visiblePages(): number[] {
    const total = this.totalPages();
    if (total < 2) {
      return [];
    }
    const size = Math.min(MAX_VISIBLE_PAGES, total);
    const start = Math.max(1, Math.min(this.page - Math.floor(size / 2), total - size + 1));
    return Array.from({ length: size }, (_, index) => start + index);
  }

  /** Requests a page; re-selecting the current page is a no-op. */
  protected go(page: number): void {
    if (page !== this.page) {
      this.pageChange.emit(page);
    }
  }
}
