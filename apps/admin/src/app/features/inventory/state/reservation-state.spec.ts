/**
 * Behavior tests for the Sub-Phase 13.10 `ReservationState`.
 *
 * `InventoryAdminApiService` (already covered by its own delegation spec)
 * is stubbed at its typed seam so these tests own the state logic:
 * scoped loading, blank-input no-ops, duplicate-submit prevention,
 * settled refetch, and contract-violation handling.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { defer, of, throwError, type Observable } from 'rxjs';
import { ApiError } from '@flux/api';
import type { InventoryReservationResponse } from '@flux/models';
import { InventoryAdminApiService } from '../data-access/inventory-admin-api.service';
import { ReservationState } from './reservation-state';

const RESERVATION_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

function reservation(): InventoryReservationResponse {
  return {
    reservationId: RESERVATION_ID,
    orderId: '4fa85f64-5717-4562-b3fc-2c963f66afa6',
    sku: 'TEE-BLK-M',
    quantity: 2,
    status: 0,
    expiresAt: '2026-09-04T10:30:00Z',
    createdAtUtc: '2026-09-04T10:00:00Z',
    updatedAtUtc: '2026-09-04T10:00:00Z',
  };
}

function setup(getReservation?: (id: string) => Observable<unknown>): {
  state: ReservationState;
  getReservation: ReturnType<typeof vi.fn>;
} {
  const getReservationMock = vi.fn(
    (id: string) =>
      getReservation?.(id) ??
      of({ isSuccess: true, message: 'Operation completed successfully.', data: reservation() }),
  );
  TestBed.configureTestingModule({
    providers: [
      ReservationState,
      { provide: InventoryAdminApiService, useValue: { getReservation: getReservationMock } },
    ],
  });
  return { state: TestBed.inject(ReservationState), getReservation: getReservationMock };
}

describe('ReservationState', () => {
  it('starts idle with no record', () => {
    const { state } = setup();

    expect(state.reservation().status).toBe('idle');
    expect(state.reservation().data).toBeNull();
  });

  it('trims the id before transport', () => {
    const { state, getReservation } = setup();
    state.lookup(`  ${RESERVATION_ID}  `);

    expect(getReservation).toHaveBeenCalledWith(RESERVATION_ID);
    expect(state.reservation().status).toBe('success');
    expect(state.reservation().data).toEqual(reservation());
  });

  it('ignores blank input and duplicate in-flight lookups', () => {
    let release!: (value: unknown) => void;
    const pending = new Promise<unknown>((resolve) => {
      release = resolve;
    });
    const { state, getReservation } = setup(() => defer(() => pending));
    state.lookup(null);
    state.lookup('   ');
    state.lookup(RESERVATION_ID);
    state.lookup(RESERVATION_ID);

    expect(getReservation).toHaveBeenCalledTimes(1);
    release({ isSuccess: true, message: 'Ok.', data: reservation() });
    return pending.then(() => {
      expect(state.reservation().status).toBe('success');
      state.lookup(RESERVATION_ID);
      expect(getReservation).toHaveBeenCalledTimes(2);
    });
  });

  it('resolves failures and dataless envelopes to error', () => {
    const rejection = new ApiError({ status: 404, message: 'Not found.' });
    const failed = setup(() => throwError(() => rejection));
    failed.state.lookup(RESERVATION_ID);

    expect(failed.state.reservation().status).toBe('error');
    expect(failed.state.reservation().error).toBe(rejection);
    TestBed.resetTestingModule();

    const dataless = setup(() => of({ isSuccess: true, data: null }));
    dataless.state.lookup(RESERVATION_ID);
    expect(dataless.state.reservation().status).toBe('error');
    expect(dataless.state.reservation().error).toBeInstanceOf(ApiError);
  });
});
