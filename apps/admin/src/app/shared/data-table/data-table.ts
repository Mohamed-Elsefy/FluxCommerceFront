/**
 * Generic admin data table for Sub-Phase 12.5 — Admin Table & Pagination
 * Primitives.
 *
 * Presentation only: renders HOW rows look (typed columns, headers, a
 * scrollable responsive wrapper, loading and empty states through the
 * shared async UI). The owning feature decides WHEN and WHAT — columns,
 * rows, and all copy arrive as inputs (already localized); committed
 * page turns belong to the sibling pagination control. No API access,
 * no state, no HTTP, no timers, and no business-specific variants
 * (`ProductTable`/`OrderTable`/… arrive as feature compositions, never
 * as forks of this component).
 *
 * Cells render through per-column value accessors (`(row) => string`),
 * so features format numbers/dates/amounts before display and this
 * component never invents formatting. Row selection is omitted: no
 * Phase 12 consumer justifies it.
 *
 * SSR/hydration safe: static markup from inputs only, no browser APIs.
 * RTL safe: logical properties only, no direction branching.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { EmptyState, LoadingIndicator } from '@flux/ui';

/** Typed table column: header copy plus a row-to-text cell accessor. */
export interface AdminDataColumn<T> {
  /** Stable column identity (header tracking and future extensions). */
  readonly key: string;
  /** Column header copy (owner-localized). */
  readonly header: string;
  /** Cell text for a row (features format values before display). */
  readonly value: (row: T) => string;
}

@Component({
  selector: 'admin-data-table',
  imports: [EmptyState, LoadingIndicator],
  templateUrl: './data-table.html',
  styleUrl: './data-table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDataTable<T> {
  /** Typed columns (headers render in order). */
  @Input() columns: readonly AdminDataColumn<T>[] = [];
  /** Rows to render (feature-owned snapshot, typically a page envelope's items). */
  @Input() rows: readonly T[] = [];
  /** Loading flag: replaces the body with the loading indicator. */
  @Input() loading = false;
  /** Accessible table caption (owner-localized, optional). */
  @Input() caption: string | null = null;
  /** Empty-state heading (owner-localized, required). */
  @Input({ required: true }) emptyTitle = '';
  /** Empty-state supporting text (owner-localized). */
  @Input() emptyMessage: string | null = null;
  /** Loading text (owner-localized). */
  @Input() loadingLabel = 'Loading';

  /** Cell text for a row (thin projection over the column accessor). */
  protected cell(column: AdminDataColumn<T>, row: T): string {
    return column.value(row);
  }
}
