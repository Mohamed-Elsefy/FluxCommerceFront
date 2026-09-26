import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AdminNotificationService } from './notification-service';

function setup(): AdminNotificationService {
  TestBed.configureTestingModule({});
  TestBed.inject(AdminNotificationService).clear();
  return TestBed.inject(AdminNotificationService);
}

describe('AdminNotificationService', () => {
  it('creates notifications with deterministic ids', () => {
    const service = setup();

    const first = service.show({ type: 'info', title: 'T', message: 'M' });

    expect(typeof first).toBe('number');
    expect(service.notifications()).toHaveLength(1);
    expect(service.notifications()[0]).toMatchObject({ type: 'info', title: 'T', message: 'M' });
  });

  it('raises every supported type and keeps multiples in order', () => {
    const service = setup();

    service.success('S', 'ok');
    service.info('I', 'note');
    service.warning('W', 'careful');
    service.error('E', 'broken');

    expect(service.notifications().map((item) => item.type)).toEqual([
      'success',
      'info',
      'warning',
      'error',
    ]);
    const ids = service.notifications().map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('dismisses one notification and clears the rest', () => {
    const service = setup();
    const first = service.success('S', 'ok');
    service.error('E', 'broken');

    service.dismiss(first);
    expect(service.notifications().map((item) => item.type)).toEqual(['error']);

    service.dismiss(9999);
    expect(service.notifications()).toHaveLength(1);

    service.clear();
    expect(service.notifications()).toEqual([]);
  });
});
