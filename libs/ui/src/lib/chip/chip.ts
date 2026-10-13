/**
 * Chip primitive — Kinetic filter pills & segmented options (DESIGN §6.4b).
 *
 * Presentation only: pill, selected state, urgency tone. Features own the
 * filter semantics. Keyboard/a11y comes from the native button.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type ChipTone = 'default' | 'urgency';

@Component({
  selector: 'flux-chip',
  templateUrl: './chip.html',
  styleUrl: './chip.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Chip {
  @Input() selected = false;
  @Input() tone: ChipTone = 'default';
  @Input() disabled = false;
}
