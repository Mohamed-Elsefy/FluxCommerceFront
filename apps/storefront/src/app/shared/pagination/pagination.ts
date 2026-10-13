/**
 * Storefront shared pagination control for Refactoring Phase B (step
 * B2b) — Pager Unification.
 *
 * Unifies the byte-identical `OrdersPagination` (Sub-Phase 10.3) and
 * `PaymentsMinePagination` (Supplement S1, Step S1.9): same inputs,
 * same sliding-window logic, same markup, same styling. The catalog
 * `ProductPagination` stays feature-owned — its visuals differ
 * (spacing/typography/hover states) and it carries no `disabled` lock.
 *
 * Presentation only: renders HOW page navigation looks (First,
 * Previous, numbered pages, Next, Last) for a backend `PagedResult`.
 * The owning page decides WHEN and WHAT — effective page, page size,
 * and total count arrive as inputs (always from the RESPONSE envelope,
 * never request values, per the pagination contract); committed pages
 * leave through `pageChange`. No API access, no state, no HTTP, no
 * timers.
 *
 * Reuses the Phase 1 pagination infrastructure instead of duplicating
 * it: page counts and boundaries come from `totalPagesOf` (`@flux/api`).
 * Hidden entirely for single-page results (nothing to navigate).
 * Native buttons carry disabled states at the boundaries and while
 * `disabled` (in-flight loads); the current page is marked
 * `aria-current` and disabled. Copy arrives as one object input
 * (page-localized).
 *
 * SSR/hydration safe: static markup from inputs only, no browser APIs.
 * RTL safe: logical properties only, no direction branching.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { totalPagesOf } from '@flux/api';

/** Localized pager copy (single page-owned object input). */
export interface StorefrontPaginationCopy {
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
  selector: 'storefront-pagination',
  templateUrl: './pagination.html',
  styleUrl: './pagination.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StorefrontPagination {
  /**
   * Effective page number from the RESPONSE envelope (`pageNumber`
   * echoes backend-resolved values — never render request values here).
   */
  @Input({ required: true }) page = 1;

  /** Effective page size from the RESPONSE envelope. */
  @Input({ required: true }) pageSize = 20;

  /** Total matches across all pages (never page-relative). */
  @Input({ required: true }) totalCount = 0;

  /** Localized copy (page-owned, required). */
  @Input({ required: true }) copy!: StorefrontPaginationCopy;

  /**
   * Locks navigation while a page load is in flight (prevents
   * overlapping requests — the state owns no request queue).
   */
  @Input() disabled = false;

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
