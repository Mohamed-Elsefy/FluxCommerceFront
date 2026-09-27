/**
 * Behavior tests for the Sub-Phase 13.9 `StockState`.
 *
 * `InventoryAdminApiService` (already covered by its own delegation spec)
 * is stubbed at its typed seam so these tests own the state logic: SKU
 * normalization, blank-input no-ops, duplicate-submit prevention,
 * settled refetch, and contract-violation handling.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { defer, of, throwError, type Observable } from 'rxjs';
import { ApiError } from '@flux/api';
import type { InventoryItemResponse } from '@flux/models';
import { InventoryAdminApiService } from '../data-access/inventory-admin-api.service';
import { StockState } from './stock-state';

function stock(): InventoryItemResponse {
  return {
    sku: 'TEE-BLK-M',
    onHandQuantity: 100,
    reservedQuantity: 2,
    availableQuantity: 98,
    updatedAtUtc: '2026-09-04T10:00:00Z',
  };
}

function setup(getItem?: (sku: string) => Observable<unknown>): {
  state: StockState;
  getItem: ReturnType<typeof vi.fn>;
} {
  const getItemMock = vi.fn(
    (sku: string) =>
      getItem?.(sku) ??
      of({ isSuccess: true, message: 'Operation completed successfully.', data: stock() }),
  );
  TestBed.configureTestingModule({
    providers: [
      StockState,
      { provide: InventoryAdminApiService, useValue: { getItem: getItemMock } },
    ],
  });
  return { state: TestBed.inject(StockState), getItem: getItemMock };
}

describe('StockState', () => {
  it('starts idle with no record', () => {
    const { state } = setup();

    expect(state.stock().status).toBe('idle');
    expect(state.stock().data).toBeNull();
  });

  it('normalizes editor text before transport', () => {
    const { state, getItem } = setup();
    state.lookup('  tee-blk-m ');

    expect(getItem).toHaveBeenCalledWith('TEE-BLK-M');
    expect(state.stock().status).toBe('success');
    expect(state.stock().data).toEqual(stock());
  });

  it('ignores blank input and duplicate in-flight lookups', () => {
    let release!: (value: unknown) => void;
    const pending = new Promise<unknown>((resolve) => {
      release = resolve;
    });
    const { state, getItem } = setup(() => defer(() => pending));
    state.lookup(null);
    state.lookup('   ');
    state.lookup('TEE-BLK-M');
    state.lookup('OTHER');

    expect(getItem).toHaveBeenCalledTimes(1);
    expect(getItem).toHaveBeenCalledWith('TEE-BLK-M');
    release({ isSuccess: true, message: 'Ok.', data: stock() });
    return pending.then(() => {
      expect(state.stock().status).toBe('success');
    });
  });

  it('refetches settled records on explicit lookup', () => {
    const { state, getItem } = setup();
    state.lookup('TEE-BLK-M');
    state.lookup('TEE-BLK-M');

    expect(getItem).toHaveBeenCalledTimes(2);
  });

  it('resolves failures and dataless envelopes to error', () => {
    const rejection = new ApiError({ status: 404, message: 'Not found.' });
    const failed = setup(() => throwError(() => rejection));
    failed.state.lookup('MISSING');

    expect(failed.state.stock().status).toBe('error');
    expect(failed.state.stock().error).toBe(rejection);
    TestBed.resetTestingModule();

    const dataless = setup(() => of({ isSuccess: true, data: null }));
    dataless.state.lookup('MISSING');
    expect(dataless.state.stock().status).toBe('error');
    expect(dataless.state.stock().error).toBeInstanceOf(ApiError);
  });
});
