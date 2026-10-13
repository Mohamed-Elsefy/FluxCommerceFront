/**
 * Catalog search input component for Sub-Phase 5.5 — Search.
 *
 * Presentation only: renders HOW the search field looks (labelled
 * `type="search"` input) and emits raw text on every keystroke. The owning
 * page decides WHEN a value becomes a query — debouncing, `page = 1`
 * resets, and request cancellation live there, so this component stays
 * timing-free like every other presentational component (no RxJS, no
 * timers). No API access, no state, no HTTP.
 *
 * The input is controlled (`value` in, `valueChange` out): the page feeds
 * back the committed query text, so deep links, back-navigation, and
 * cleared searches always display the active query. The label wraps the
 * input for implicit accessible association without id bookkeeping.
 *
 * SSR/hydration safe: static markup from inputs only, no browser APIs.
 * RTL safe: logical properties only, no direction branching.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'catalog-search-input',
  templateUrl: './search-input.html',
  styleUrl: './search-input.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchInput {
  /** Committed query text to display (page-owned, echoed back). */
  @Input() value = '';

  /** Accessible field label (page-localized, required). */
  @Input({ required: true }) label!: string;

  /** Hint text (page-localized). */
  @Input() placeholder: string | null = null;

  /** Emitted with the raw field text on every keystroke (undebounced). */
  @Output() readonly valueChange = new EventEmitter<string>();

  /** Forwards the raw field text; timing stays with the owning page. */
  protected onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }
}
