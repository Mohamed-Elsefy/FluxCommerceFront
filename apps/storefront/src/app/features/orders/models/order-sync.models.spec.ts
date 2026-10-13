/**
 * Unit tests for the Sub-Phase 10.6 order synchronization models.
 *
 * Covers the pure helpers only (sync-need detection, polling budget
 * pins, stopping-vs-transient failure classification). Timer behavior
 * stays in `order-details-sync.spec.ts`; backend shapes stay in
 * `@flux/models` specs.
 */

import { describe, expect, it } from 'vitest';
import { ApiError } from '@flux/api';
import {
  ORDER_SYNC_MAX_ATTEMPTS,
  ORDER_SYNC_POLL_INTERVAL_MS,
  isSyncStoppingFailure,
  needsOrderSync,
} from './order-sync.models';

describe('order sync budget', () => {
  it('pins the bounded polling cadence', () => {
    expect(ORDER_SYNC_POLL_INTERVAL_MS).toBe(2000);
    expect(ORDER_SYNC_MAX_ATTEMPTS).toBe(30);
  });
});

describe('needsOrderSync', () => {
  it('syncs known non-terminal orders only', () => {
    expect(needsOrderSync('Pending')).toBe(true);
    expect(needsOrderSync('Confirmed')).toBe(false);
    expect(needsOrderSync('Cancelled')).toBe(false);
  });

  it('keeps polling unknown future strings (never fabricates terminality)', () => {
    expect(needsOrderSync('Refunding')).toBe(true);
    expect(needsOrderSync('')).toBe(true);
  });
});

describe('isSyncStoppingFailure', () => {
  it('stops at once on auth, denial, and missing failures', () => {
    expect(isSyncStoppingFailure(new ApiError({ status: 401, message: 'x' }))).toBe(true);
    expect(isSyncStoppingFailure(new ApiError({ status: 403, message: 'x' }))).toBe(true);
    expect(isSyncStoppingFailure(new ApiError({ status: 404, message: 'x' }))).toBe(true);
    expect(isSyncStoppingFailure({ status: 401 })).toBe(true);
  });

  it('continues through transient failures', () => {
    expect(isSyncStoppingFailure(new ApiError({ status: 0, message: 'x' }))).toBe(false);
    expect(isSyncStoppingFailure(new ApiError({ status: 400, message: 'x' }))).toBe(false);
    expect(isSyncStoppingFailure(new ApiError({ status: 409, message: 'x' }))).toBe(false);
    expect(isSyncStoppingFailure(new ApiError({ status: 500, message: 'x' }))).toBe(false);
    expect(isSyncStoppingFailure(new ApiError({ status: 503, message: 'x' }))).toBe(false);
    expect(isSyncStoppingFailure(null)).toBe(false);
    expect(isSyncStoppingFailure(undefined)).toBe(false);
    expect(isSyncStoppingFailure(new Error('boom'))).toBe(false);
  });
});
