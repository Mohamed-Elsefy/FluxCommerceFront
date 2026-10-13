import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AdminNotificationService } from '../notification-service';
import { AdminNotificationHost } from './notification-host';

function setup(): { fixture: ComponentFixture<AdminNotificationHost>; element: HTMLElement } {
  TestBed.configureTestingModule({});
  TestBed.inject(AdminNotificationService).clear();
  const fixture = TestBed.createComponent(AdminNotificationHost);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('AdminNotificationHost', () => {
  it('renders nothing without notifications', () => {
    const { element } = setup();

    expect(element.querySelector('.notification-host')).toBeNull();
  });

  it('renders multiple notifications with type-driven live roles', () => {
    const { fixture, element } = setup();
    const center = TestBed.inject(AdminNotificationService);
    center.success('Saved', 'Product saved.');
    center.error('Failed', 'Order failed.');
    fixture.detectChanges();

    const items = [...element.querySelectorAll('.notification')];
    expect(items).toHaveLength(2);
    expect(items[0].getAttribute('role')).toBe('status');
    expect(items[1].getAttribute('role')).toBe('alert');
    expect(items[0].textContent).toContain('Product saved.');
    expect(element.querySelector('.notification-host')?.getAttribute('aria-label')).toBe(
      'Notifications',
    );
  });

  it('dismisses one notification through its action', () => {
    const { fixture, element } = setup();
    const center = TestBed.inject(AdminNotificationService);
    center.info('Note', 'First.');
    center.info('Note', 'Second.');
    fixture.detectChanges();

    (element.querySelector('.notification-dismiss') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(center.notifications()).toHaveLength(1);
    expect(element.querySelectorAll('.notification')).toHaveLength(1);
    expect(element.querySelector('.notification')?.textContent).toContain('Second.');
  });
});
