/**
 * Input primitive for Sub-Phase 3.4 — Core UI Primitives.
 *
 * Presentation only: renders HOW a single-line text field looks (label,
 * placeholder, hint, error) and emits WHAT the user typed via `valueChange`.
 * The feature owns validation, form wiring, and localized copy. The label
 * wraps the control (implicit association — no generated ids, so SSR and
 * hydration stay identical). Keyboard behavior, focus, and disabled
 * semantics come from the native `<input>` element.
 *
 * Errors render with `role="alert"` and `aria-invalid`; hints are plain
 * supporting text. Visual values come from `libs/theming` tokens — never
 * `ThemeService`.
 *
 * SSR/hydration safe: pure markup + CSS. RTL safe: logical properties only.
 *
 * Uses `@Input()`/`@Output()` decorators (not signal I/O): `libs/*` specs
 * run under the raw Vitest runner, which lacks the Angular compiler
 * transform that registers signal inputs — decorator metadata stays
 * runtime-readable. (`Input` here is this component; the decorator is
 * imported as `NgInput` to avoid the name collision.)
 */

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input as NgInput,
  Output,
} from '@angular/core';

/** Single-line field kinds supported by the primitive. */
export type InputType = 'text' | 'email' | 'password' | 'search' | 'tel' | 'url';

@Component({
  selector: 'flux-input',
  templateUrl: './input.html',
  styleUrl: './input.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Input {
  /** Visible label (feature-localized). Implicitly associated with the control. */
  @NgInput() label: string | null = null;
  /** Native field kind. */
  @NgInput() type: InputType = 'text';
  /** Placeholder hint (never a label replacement). */
  @NgInput() placeholder: string | null = null;
  /** Current value (feature-owned). */
  @NgInput() value = '';
  /** Non-interactive state (feature-owned). */
  @NgInput() disabled = false;
  /** Native required marker (feature-owned validation decides). */
  @NgInput() required = false;
  /** Supporting text shown when there is no error (feature-localized). */
  @NgInput() hint: string | null = null;
  /** Validation message; switches the field to its error state (feature-localized). */
  @NgInput() error: string | null = null;
  /** Emitted with the typed value on every keystroke. */
  @Output() readonly valueChange = new EventEmitter<string>();

  /** Forwards native keystrokes as `valueChange` — no parsing, no validation. */
  protected onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }
}
