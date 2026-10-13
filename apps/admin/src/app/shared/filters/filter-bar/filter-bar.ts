/**
 * Admin filter bar for Sub-Phase 12.6 — Filtering & Form Primitives.
 *
 * Layout container for one filter row: projected filter controls in a
 * wrapping flex row plus an optional clear-all action. Dumb by design —
 * filter state and reset semantics stay in the owning feature (the
 * `clear` event only notifies). SSR/hydration safe; RTL safe (logical
 * properties, direction-aware flow).
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'admin-filter-bar',
  templateUrl: './filter-bar.html',
  styleUrl: './filter-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminFilterBar {
  /** Accessible landmark name (owner-localized, required). */
  @Input({ required: true }) label = '';
  /** Clear-all action text (owner-localized; null hides the action). */
  @Input() clearLabel: string | null = null;
  /** Emitted when the clear-all action activates. */
  @Output() readonly clear = new EventEmitter<void>();
}
