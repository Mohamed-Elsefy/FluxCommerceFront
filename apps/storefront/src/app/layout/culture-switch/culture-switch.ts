/**
 * Storefront culture switch (language picker).
 *
 * Presentation only: renders HOW the active culture is chosen (a native
 * select over the supported cultures with their native display names —
 * self-localizing, no translation bundle needed). The owning shell
 * decides WHAT the selection does (wired to `CultureService` in the
 * header); selection changes leave through `cultureChange`. No API,
 * state, or persistence lives here (`ARCHITECTURE.md` §8).
 *
 * Native select gives keyboard, screen-reader, and mobile behavior
 * free; the label keeps shell-chrome English, matching the existing
 * shell convention (skip link, brand). SSR/hydration safe: markup
 * derives from inputs only — no browser APIs. RTL safe: logical
 * properties only, no direction branching.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { isSupportedCulture, type Culture, type CultureMetadata } from '@flux/i18n';

@Component({
  selector: 'storefront-culture-switch',
  templateUrl: './culture-switch.html',
  styleUrl: './culture-switch.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StorefrontCultureSwitch {
  /** Supported cultures to offer (source: `SUPPORTED_CULTURE_METADATA`). */
  @Input() cultures: readonly CultureMetadata[] = [];
  /** Currently active culture code. */
  @Input() selected: Culture = 'en';
  /** Visible + accessible picker name (shell-localized by the owner). */
  @Input() label = 'Language';
  /** Emitted with the newly chosen culture (validated — never unknown). */
  @Output() readonly cultureChange = new EventEmitter<Culture>();

  /** Forwards validated selections; unknown values are ignored. Public for testability. */
  onChange(event: Event): void {
    const value = (event.target as HTMLSelectElement | null)?.value ?? '';
    if (isSupportedCulture(value)) {
      this.cultureChange.emit(value);
    }
  }
}
