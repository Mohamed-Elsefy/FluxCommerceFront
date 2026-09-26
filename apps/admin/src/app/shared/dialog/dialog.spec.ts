import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AdminDialog } from './dialog';

@Component({
  selector: 'admin-dialog-host',
  imports: [AdminDialog],
  template: `<button class="trigger" type="button" (click)="open = true">Open</button>
    <admin-dialog [open]="open" title="Confirm removal" (closed)="open = false">
      <p>Body copy.</p>
      <div data-dialog-actions>
        <button class="confirm" type="button">Confirm</button>
      </div>
    </admin-dialog>`,
})
class DialogHost {
  open = false;
}

function setup(): { fixture: ComponentFixture<DialogHost>; element: HTMLElement } {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(DialogHost);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

async function openDialog(
  fixture: ComponentFixture<DialogHost>,
): Promise<{ element: HTMLElement; trigger: HTMLButtonElement }> {
  const element = fixture.nativeElement as HTMLElement;
  const trigger = element.querySelector('.trigger') as HTMLButtonElement;
  trigger.focus();
  // Drive opening through a real event: programmatic property writes plus
  // explicit detectChanges do not refresh host-bound inputs in every
  // runner, while DOM events run change detection everywhere.
  trigger.click();
  await fixture.whenStable();
  fixture.detectChanges();
  return { element, trigger };
}

describe('AdminDialog', () => {
  it('renders nothing while closed and the titled dialog while open', async () => {
    const { fixture, element } = setup();

    expect(element.querySelector('[role="dialog"]')).toBeNull();

    (element.querySelector('.trigger') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    const dialog = element.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('admin-dialog-title');
    expect(element.querySelector('.dialog-title')?.textContent).toBe('Confirm removal');
    expect(element.querySelector('.dialog-content')?.textContent).toContain('Body copy.');
    expect(element.querySelector('.dialog-actions .confirm')).not.toBeNull();
  });

  it('emits closed from the close button and the backdrop', async () => {
    const { fixture, element } = setup();
    await openDialog(fixture);

    (element.querySelector('.dialog-close') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(element.querySelector('[role="dialog"]')).toBeNull();

    await openDialog(fixture);
    (element.querySelector('.dialog-backdrop-dismiss') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(element.querySelector('[role="dialog"]')).toBeNull();
  });

  it('emits closed on Escape', async () => {
    const { fixture, element } = setup();
    await openDialog(fixture);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(element.querySelector('[role="dialog"]')).toBeNull();
  });

  it('moves focus into the panel on open and restores it on close', async () => {
    const { fixture, element } = setup();
    const { trigger } = await openDialog(fixture);

    expect(document.activeElement).toBe(element.querySelector('.dialog-panel'));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(element.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('cycles Tab inside the panel', async () => {
    const { fixture, element } = setup();
    await openDialog(fixture);

    const panel = element.querySelector('.dialog-panel') as HTMLElement;
    const focusable = [...panel.querySelectorAll('button')].filter(
      (node) => !node.classList.contains('dialog-backdrop-dismiss'),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    last.focus();
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(first);

    first.focus();
    panel.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, shiftKey: true }),
    );
    expect(document.activeElement).toBe(last);
  });
});
