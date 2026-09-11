/**
 * Filter select component for Sub-Phase 5.6 — Filtering & Sorting.
 *
 * Presentation only: renders HOW one catalog filter/sort dimension looks
 * (a labelled native select). The owning page decides WHEN and WHAT —
 * options, the current value, and labels arrive as inputs; committed
 * selections leave through `valueChange`. One generic component serves
 * status, visibility, and sort alike (same interaction, same states), so
 * no near-duplicate dropdowns exist. No API access, no state, no HTTP,
 * no timers.
 *
 * Native `<select>` is deliberate: keyboard operation, screen-reader
 * semantics, and option announcement come free, with none of the custom
 * dropdown ARIA surface a hand-rolled control would need. The label wraps
 * the control for implicit accessible association without id bookkeeping.
 *
 * Option values are opaque UI tokens (`''` = dimension cleared); the page
 * maps them back to typed state through the `catalog-query-state`
 * parsers — this component never interprets them.
 *
 * SSR/hydration safe: static markup from inputs only, no browser APIs.
 * RTL safe: logical properties only, no direction branching.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

/** One selectable dimension value: opaque token plus localized label. */
export interface FilterOption {
  readonly value: string;
  readonly label: string;
}

@Component({
  selector: 'catalog-filter-select',
  templateUrl: './filter-select.html',
  styleUrl: './filter-select.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterSelect {
  /** Accessible field label (page-localized, required). */
  @Input({ required: true }) label!: string;

  /** Selectable values in display order (first is conventionally "all"). */
  @Input({ required: true }) options: readonly FilterOption[] = [];

  /** Currently selected token (page-owned, echoed back). */
  @Input() value = '';

  /** Emitted with the selected token on every change (committed at once). */
  @Output() readonly valueChange = new EventEmitter<string>();

  /** Forwards the selected token; interpretation stays with the page. */
  protected onChange(event: Event): void {
    this.valueChange.emit((event.target as HTMLSelectElement).value);
  }
}
