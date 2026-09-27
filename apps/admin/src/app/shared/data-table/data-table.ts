/**
 * Generic admin data table for Sub-Phase 12.5 — Admin Table & Pagination
 * Primitives (extended in 13.3 with per-column row links).
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
 * component never invents formatting. Columns may additionally expose a
 * row link (`(row) => string | null`, e.g. a details route): linked cells
 * render a real anchor (deep-linkable, keyboard- and screen-reader-safe);
 * `null` renders plain text. Row selection stays omitted: no consumer
 * justifies it.
 *
 * SSR/hydration safe: static markup from inputs only, no browser APIs.
 * RTL safe: logical properties only, no direction branching.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyState, LoadingIndicator } from '@flux/ui';

/** Typed table column: header copy plus a row-to-text cell accessor. */
export interface AdminDataColumn<T> {
  /** Stable column identity (header tracking and future extensions). */
  readonly key: string;
  /** Column header copy (owner-localized). */
  readonly header: string;
  /** Cell text for a row (features format values before display). */
  readonly value: (row: T) => string;
  /**
   * Optional row link for the cell (feature-owned route, e.g. a details
   * page). `null` renders plain text — links never invent destinations.
   */
  readonly link?: (row: T) => string | null;
}

@Component({
  selector: 'admin-data-table',
  imports: [RouterLink, EmptyState, LoadingIndicator],
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
  @Input() emptyTitle = '';
  /** Empty-state supporting text (owner-localized). */
  @Input() emptyMessage: string | null = null;
  /** Loading text (owner-localized). */
  @Input() loadingLabel = 'Loading';

  /** Cell text for a row (thin projection over the column accessor). */
  protected cell(column: AdminDataColumn<T>, row: T): string {
    return column.value(row);
  }

  /** Row link for a cell (`null` renders plain text). */
  protected link(column: AdminDataColumn<T>, row: T): string | null {
    return column.link?.(row) ?? null;
  }
}
