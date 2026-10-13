/**
 * Admin dialog for Sub-Phase 12.7 — Dialogs & Notifications.
 *
 * Generic accessible modal: title, projected content, projected actions,
 * backdrop dismissal, Escape dismissal, and focus management (moves
 * focus into the panel on open, cycles Tab inside the panel, restores
 * the previously focused element on close). Dumb by design — open state
 * stays in the owning feature (`open` in, `closed` out); no business
 * domains leak in.
 *
 * The panel is a `div` with `role="dialog"` + `aria-modal` (rather than
 * the native `<dialog>` element, whose `showModal` is unavailable in
 * several embedded renderers and untestable in jsdom) following the
 * same overlay/Escape/focus-return pattern as the shell drawer.
 * CSR-only portal: no server rendering to stay neutral for.
 * RTL safe: logical properties only, no direction branching.
 */

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  inject,
} from '@angular/core';

/** Focusable selectors for Tab cycling inside the panel. */
const FOCUSABLE_SELECTORS =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

@Component({
  selector: 'admin-dialog',
  templateUrl: './dialog.html',
  styleUrl: './dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDialog implements OnChanges {
  /** Whether the dialog is open (feature-owned). */
  @Input({ required: true }) open = false;
  /** Dialog title (owner-localized, required). */
  @Input({ required: true }) title = '';
  /** Title element id for `aria-labelledby` (owner-provided). */
  @Input() titleId = 'admin-dialog-title';
  /** Close action accessible name (owner-localized). */
  @Input() closeLabel = 'Close dialog';
  /** Backdrop accessible name (owner-localized). */
  @Input() backdropLabel = 'Dismiss dialog';
  /** Emitted for close-button, backdrop, and Escape dismissals. */
  @Output() readonly closed = new EventEmitter<void>();

  private readonly host = inject(ElementRef<HTMLElement>);
  private previousFocus: Element | null = null;

  ngOnChanges(): void {
    if (this.open) {
      this.previousFocus = document.activeElement;
      queueMicrotask(() => this.panel()?.focus());
    } else {
      this.restoreFocus();
    }
  }

  /** Dismisses on Escape from anywhere while open. */
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open) {
      this.closed.emit();
    }
  }

  /** Cycles Tab inside the panel while open (modal focus trap). */
  protected onKeydown(event: KeyboardEvent): void {
    if (!this.open || event.key !== 'Tab') {
      return;
    }
    const panel = this.panel();
    if (panel === null) {
      return;
    }
    const focusable = [...panel.querySelectorAll(FOCUSABLE_SELECTORS)].filter(
      (node): node is HTMLElement => node instanceof HTMLElement,
    );
    if (focusable.length === 0) {
      event.preventDefault();
      panel.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === panel || active === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private restoreFocus(): void {
    const previous = this.previousFocus;
    this.previousFocus = null;
    if (previous instanceof HTMLElement) {
      previous.focus();
    }
  }

  /** Rendered panel (queried from the host: synchronous after render). */
  private panel(): HTMLElement | null {
    return this.host.nativeElement.querySelector('.dialog-panel');
  }
}
