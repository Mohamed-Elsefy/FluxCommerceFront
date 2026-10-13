import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Alert } from './alert';

@Component({
  selector: 'flux-alert-host',
  imports: [Alert],
  template: `<flux-alert [variant]="variant" [title]="title">Body text</flux-alert>`,
})
class AlertHost {
  variant: 'info' | 'success' | 'warning' | 'danger' = 'info';
  title: string | null = 'Heads up';
}

function setup(
  variant: AlertHost['variant'] = 'info',
  title: string | null = 'Heads up',
): HTMLElement {
  const fixture = TestBed.createComponent(AlertHost);
  fixture.componentInstance.variant = variant;
  fixture.componentInstance.title = title;
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('Alert', () => {
  it('renders the title and body with the info variant by default', () => {
    const element = setup();

    const alert = element.querySelector('.alert');
    expect(alert?.getAttribute('data-variant')).toBe('info');
    expect(alert?.getAttribute('role')).toBe('status');
    expect(element.querySelector('.title')?.textContent).toBe('Heads up');
    expect(element.querySelector('.body')?.textContent).toBe('Body text');
  });

  it('announces politely for success and interrupts for warning and danger', () => {
    expect(setup('success').querySelector('.alert')?.getAttribute('role')).toBe('status');
    expect(setup('warning').querySelector('.alert')?.getAttribute('role')).toBe('alert');
    expect(setup('danger').querySelector('.alert')?.getAttribute('role')).toBe('alert');
  });

  it('omits the title when none is given', () => {
    const element = setup('info', null);

    expect(element.querySelector('.title')).toBeNull();
    expect(element.querySelector('.body')?.textContent).toBe('Body text');
  });
});
