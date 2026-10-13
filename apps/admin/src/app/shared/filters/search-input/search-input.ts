/**
 * Admin search input for Sub-Phase 12.6 — Filtering & Form Primitives.
 *
 * Thin reactive-form wrapper for filter search boxes: a labeled search
 * field whose keystrokes flow through the bound control (owning
 * features debounce `valueChanges` in state when they need to), plus a
 * clear action that resets the query. `type="search"` gives keyboard
 * and assistive-technology semantics free. Dumb by design — filtering
 * itself stays in the owning feature. SSR/hydration safe; RTL safe
 * (logical properties only).
 */

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  inject,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { Subscription } from 'rxjs';

@Component({
  selector: 'admin-search-input',
  imports: [ReactiveFormsModule],
  templateUrl: './search-input.html',
  styleUrl: './search-input.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSearchInput implements OnChanges, OnDestroy {
  /** Bound query control (feature-owned). */
  @Input({ required: true }) control!: FormControl<string | null>;
  /** Visible label (owner-localized, required). */
  @Input({ required: true }) label = '';
  /** Control id for label association (owner-provided). */
  @Input() fieldId: string | null = null;
  /** Placeholder text (owner-localized). */
  @Input() placeholder: string | null = null;
  /** Clear action text (owner-localized; null hides the action). */
  @Input() clearLabel: string | null = null;

  private readonly changeDetector = inject(ChangeDetectorRef);
  private controlEvents: Subscription | null = null;

  /**
   * Refreshes on every control event: `FormControl` mutations do not
   * touch @Inputs, so an `OnPush` view reading the query (clear-action
   * visibility) would otherwise stay stale.
   */
  ngOnChanges(): void {
    this.controlEvents?.unsubscribe();
    this.controlEvents =
      this.control?.events.subscribe(() => this.changeDetector.markForCheck()) ?? null;
  }

  ngOnDestroy(): void {
    this.controlEvents?.unsubscribe();
  }

  /** Resets the query (the feature observes the control stream). */
  protected clear(): void {
    this.control.setValue('');
  }
}
