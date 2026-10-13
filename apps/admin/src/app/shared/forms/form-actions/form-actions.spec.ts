import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { AdminFormActions } from './form-actions';

function setup(input: { submitting?: boolean; disabled?: boolean; cancelLabel?: string | null }): {
  fixture: ComponentFixture<AdminFormActions>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(AdminFormActions);
  fixture.componentRef.setInput('submitLabel', 'Save');
  fixture.componentRef.setInput(
    'cancelLabel',
    input.cancelLabel === undefined ? 'Cancel' : input.cancelLabel,
  );
  fixture.componentRef.setInput('submittingLabel', 'Saving…');
  fixture.componentRef.setInput('submitting', input.submitting ?? false);
  fixture.componentRef.setInput('disabled', input.disabled ?? false);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('AdminFormActions', () => {
  it('emits submit and cancel activations', () => {
    const { fixture, element } = setup({});
    const submitted = vi.fn();
    const cancelled = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);
    fixture.componentInstance.cancelled.subscribe(cancelled);

    (element.querySelector('.form-actions-submit') as HTMLButtonElement).click();
    (element.querySelector('.form-actions-cancel') as HTMLButtonElement).click();

    expect(submitted).toHaveBeenCalledTimes(1);
    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it('locks submission while submitting with progress copy', () => {
    const { element } = setup({ submitting: true });
    const submit = element.querySelector('.form-actions-submit') as HTMLButtonElement;

    expect(submit.disabled).toBe(true);
    expect(submit.textContent?.trim()).toBe('Saving…');
    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();
  });

  it('locks submission while disabled without progress copy', () => {
    const { element } = setup({ disabled: true });
    const submit = element.querySelector('.form-actions-submit') as HTMLButtonElement;

    expect(submit.disabled).toBe(true);
    expect(submit.textContent?.trim()).toBe('Save');
    expect(element.querySelector('flux-loading-indicator')).toBeNull();
  });

  it('hides the cancel action without a label', () => {
    const { element } = setup({ cancelLabel: null });

    expect(element.querySelector('.form-actions-cancel')).toBeNull();
  });
});
