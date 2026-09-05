import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ErrorState } from './error-state';

function textOf(element: HTMLElement, selector: string): string | null {
  return element.querySelector(selector)?.textContent?.trim() ?? null;
}

describe('ErrorState', () => {
  it('announces the failure with default copy and a retry affordance', () => {
    const fixture = TestBed.createComponent(ErrorState);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[role="alert"]')).not.toBeNull();
    expect(textOf(element, '.title')).toBe('Something went wrong');
    expect(element.querySelector('.message')).toBeNull();
    expect(textOf(element, 'flux-retry-button button')).toBe('Retry');
  });

  it('renders feature copy and hides retry when the feature opts out', () => {
    const fixture = TestBed.createComponent(ErrorState);
    fixture.componentInstance.title = 'Payment failed';
    fixture.componentInstance.message = 'Your card was declined.';
    fixture.componentInstance.showRetry = false;
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(textOf(element, '.title')).toBe('Payment failed');
    expect(textOf(element, '.message')).toBe('Your card was declined.');
    expect(element.querySelector('flux-retry-button')).toBeNull();
  });

  it('forwards the retry label and re-emits retry without acting itself', () => {
    const fixture = TestBed.createComponent(ErrorState);
    fixture.componentInstance.retryLabel = 'Try payment again';
    fixture.detectChanges();

    let retried = 0;
    fixture.componentInstance.retry.subscribe(() => (retried += 1));
    expect(textOf(fixture.nativeElement as HTMLElement, 'flux-retry-button button')).toBe(
      'Try payment again',
    );

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLElement>('flux-retry-button button')
      ?.click();
    expect(retried).toBe(1);
  });
});
