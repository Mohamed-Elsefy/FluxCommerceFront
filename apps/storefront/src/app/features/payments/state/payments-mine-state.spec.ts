/**
 * State tests for the S1.9 `PaymentsMineState`.
 *
 * Covers the paged resource lifecycle only (idle → loading → success |
 * empty | error, page commits, status filter, dedupe, forced retry): the
 * `PaymentApiService` transport is stubbed at its typed seam, so these
 * tests own the feature logic — envelope unwrapping, contract-breach
 * handling, page clamping, and selector behavior — without HTTP.
 *
 * Backend-authority pins: no test performs totals math or status
 * derivation — pages echo the stubbed backend payloads verbatim.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import { ApiError, type PagedApiResponse, type PagedResult } from '@flux/api';
import { PaymentApiService } from '../data-access/payment-api.service';
import type { PaymentMineRow } from '../models/payments-mine.models';
import { PAYMENTS_MINE_DEFAULT_PAGE_SIZE } from '../models/payments-mine.models';
import { PaymentsMineState } from './payments-mine-state';

const PAYMENT_ID = '22222222-2222-4222-8222-222222222222';

function row(overrides: Partial<PaymentMineRow> = {}): PaymentMineRow {
  return {
    id: PAYMENT_ID,
    orderId: '11111111-1111-4111-8111-111111111111',
    customerId: '33333333-3333-4333-8333-333333333333',
    amount: 59.98,
    currency: 'USD',
    status: 'Succeeded',
    providerPaymentIntentId: 'pi_123',
    provider: 'stripe',
    createdAtUtc: '2026-09-04T10:00:00Z',
    updatedAtUtc: '2026-09-04T10:01:00Z',
    version: 3,
    ...overrides,
  };
}

function page(overrides: Partial<PagedResult<PaymentMineRow>> = {}): PagedResult<PaymentMineRow> {
  return {
    items: [row()],
    totalCount: 1,
    pageNumber: 1,
    pageSize: PAYMENTS_MINE_DEFAULT_PAGE_SIZE,
    ...overrides,
  };
}

function envelope(data: PagedResult<PaymentMineRow> | null): PagedApiResponse<PaymentMineRow> {
  return { isSuccess: true, data };
}

interface Setup {
  state: PaymentsMineState;
  api: { listMine: ReturnType<typeof vi.fn> };
}

function setup(): Setup {
  const api = { listMine: vi.fn(() => of(envelope(page()))) };

  TestBed.configureTestingModule({
    providers: [PaymentsMineState, { provide: PaymentApiService, useValue: api }],
  });
  return { state: TestBed.inject(PaymentsMineState), api };
}

describe('PaymentsMineState initial resource', () => {
  it('starts idle on page 1 with no data and no error', () => {
    const { state, api } = setup();

    expect(state.status()).toBe('idle');
    expect(state.page()).toBeNull();
    expect(state.error()).toBeNull();
    expect(state.currentPage()).toBe(1);
    expect(state.isLoading()).toBe(false);
    expect(state.isSuccess()).toBe(false);
    expect(state.isEmpty()).toBe(false);
    expect(state.isError()).toBe(false);
    expect(api.listMine).not.toHaveBeenCalled();
  });
});

describe('PaymentsMineState loadPage', () => {
  it('loads the first page with the default page size', () => {
    const { state, api } = setup();
    state.loadPage();

    expect(api.listMine).toHaveBeenCalledTimes(1);
    expect(api.listMine).toHaveBeenCalledWith(
      { pageNumber: 1, pageSize: PAYMENTS_MINE_DEFAULT_PAGE_SIZE },
      {},
    );
    expect(state.status()).toBe('success');
    expect(state.page()).toEqual(page());
    expect(state.currentPage()).toBe(1);
    expect(state.error()).toBeNull();
  });

  it('commits page moves with the backend page size', () => {
    const { state, api } = setup();
    state.loadPage(3);

    expect(api.listMine).toHaveBeenCalledWith(
      { pageNumber: 3, pageSize: PAYMENTS_MINE_DEFAULT_PAGE_SIZE },
      {},
    );
    expect(state.currentPage()).toBe(3);
  });

  it('resolves zero-item pages to empty (never an error)', () => {
    const { state, api } = setup();
    vi.mocked(api.listMine).mockReturnValueOnce(of(envelope(page({ items: [], totalCount: 0 }))));
    state.loadPage();

    expect(state.status()).toBe('empty');
    expect(state.isEmpty()).toBe(true);
    expect(state.page()?.items).toEqual([]);
  });

  it('treats a 200 without data as failure (never a rendered list)', () => {
    const { state, api } = setup();
    vi.mocked(api.listMine).mockReturnValueOnce(of(envelope(null)));
    state.loadPage();

    expect(state.status()).toBe('error');
    expect(state.page()).toBeNull();
    expect(state.error()).not.toBeNull();
    expect(state.isError()).toBe(true);
  });

  it('lands backend failures in the error slot untouched', () => {
    const { state, api } = setup();
    const failure = new ApiError({ status: 401, message: 'Anonymous.' });
    vi.mocked(api.listMine).mockReturnValueOnce(throwError(() => failure));
    state.loadPage();

    expect(state.status()).toBe('error');
    expect(state.page()).toBeNull();
    expect(state.error()).toBe(failure);
  });

  it('dedupes concurrent same-page loads to a single request', () => {
    const { state, api } = setup();
    const pending = new Subject<PagedApiResponse<PaymentMineRow>>();
    vi.mocked(api.listMine).mockReturnValue(pending.asObservable());

    state.loadPage(2);
    expect(state.status()).toBe('loading');
    state.loadPage(2);
    state.loadPage(2);

    expect(api.listMine).toHaveBeenCalledTimes(1);

    pending.next(envelope(page({ pageNumber: 2, totalCount: 25 })));
    pending.complete();
    expect(state.status()).toBe('success');
    expect(state.currentPage()).toBe(2);
  });

  it('does not reload a settled page without force', () => {
    const { state, api } = setup();
    state.loadPage();
    state.loadPage();

    expect(api.listMine).toHaveBeenCalledTimes(1);
  });

  it('retries after errors with a fresh request for the same page', () => {
    const { state, api } = setup();
    vi.mocked(api.listMine).mockReturnValueOnce(
      throwError(() => new ApiError({ status: 0, message: 'Unreachable.' })),
    );
    state.loadPage(2);
    expect(state.status()).toBe('error');

    state.retry();
    expect(api.listMine).toHaveBeenCalledTimes(2);
    expect(api.listMine).toHaveBeenLastCalledWith(
      { pageNumber: 2, pageSize: PAYMENTS_MINE_DEFAULT_PAGE_SIZE },
      expect.objectContaining({}),
    );
    expect(state.status()).toBe('success');
  });

  it('commits a status filter with a page reset', () => {
    const { state, api } = setup();
    state.loadPage(3);
    state.setStatusFilter('Failed');

    expect(api.listMine).toHaveBeenLastCalledWith(
      { pageNumber: 1, pageSize: PAYMENTS_MINE_DEFAULT_PAGE_SIZE, status: 'Failed' },
      expect.objectContaining({}),
    );
    expect(state.currentPage()).toBe(1);
  });

  it('clears the status filter back to unfiltered', () => {
    const { state, api } = setup();
    state.setStatusFilter('Pending');
    state.setStatusFilter(null);

    expect(api.listMine).toHaveBeenLastCalledWith(
      { pageNumber: 1, pageSize: PAYMENTS_MINE_DEFAULT_PAGE_SIZE },
      expect.objectContaining({}),
    );
  });

  it('ignores redundant status commits', () => {
    const { state, api } = setup();
    state.setStatusFilter('Pending');
    state.setStatusFilter('Pending');

    expect(api.listMine).toHaveBeenCalledTimes(1);
  });
});
