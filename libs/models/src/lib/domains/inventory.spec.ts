import { describe, expect, it } from 'vitest';
import {
  RESERVATION_STATUS_FILTER_VALUES,
  isValidInventoryListQuery,
  isValidReservationListQuery,
} from './inventory';

describe('inventory transport pre-checks (Supplement S1)', () => {
  it('pins the reservation status filter vocabulary', () => {
    expect([...RESERVATION_STATUS_FILTER_VALUES]).toEqual([
      'Pending',
      'Committed',
      'Released',
      'Expired',
    ]);
  });

  it('validates inventory-list queries (negative ceiling rejected)', () => {
    expect(isValidInventoryListQuery({ search: 'SKU-' })).toBe(true);
    expect(isValidInventoryListQuery({ maxAvailable: 0 })).toBe(true);
    expect(isValidInventoryListQuery({ maxAvailable: -1 })).toBe(false);
    expect(isValidInventoryListQuery({ search: '   ' })).toBe(false);
  });

  it('validates reservation-list queries (unknown status rejected)', () => {
    expect(isValidReservationListQuery({ status: 'Committed' })).toBe(true);
    expect(isValidReservationListQuery({ status: 'Lost' })).toBe(false);
    expect(isValidReservationListQuery({ orderId: '' })).toBe(false);
  });
});
