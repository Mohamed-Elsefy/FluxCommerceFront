/**
 * Unit tests for the Sub-Phase 10.5 status presentation models.
 *
 * Covers the pure status → tone mappings only (complete backend sets,
 * unknown-value fallback, cross-concept independence). Label rendering
 * stays in the badge component specs; backend shapes stay in
 * `@flux/models` specs.
 *
 * Decoupling pins: payment-only values resolve to `neutral` (never a
 * mapped tone) on the order side and vice versa — the suite asserts
 * both directions, so no future edit can silently couple the concepts.
 */

import { describe, expect, it } from 'vitest';
import {
  ORDER_STATUS_TONES,
  PAYMENT_STATUS_TONES,
  orderStatusToneOf,
  paymentStatusToneOf,
} from './status.models';

describe('ORDER_STATUS_TONES', () => {
  it('covers the full backend order set', () => {
    expect(ORDER_STATUS_TONES).toEqual({
      Pending: 'info',
      Cancelled: 'danger',
      Confirmed: 'success',
    });
  });
});

describe('PAYMENT_STATUS_TONES', () => {
  it('covers the full backend payment set', () => {
    expect(PAYMENT_STATUS_TONES).toEqual({
      Pending: 'info',
      Processing: 'info',
      Succeeded: 'success',
      Failed: 'danger',
      Cancelled: 'neutral',
      Refunded: 'warning',
    });
  });
});

describe('orderStatusToneOf', () => {
  it('resolves known order statuses to their tones', () => {
    expect(orderStatusToneOf('Pending')).toBe('info');
    expect(orderStatusToneOf('Confirmed')).toBe('success');
    expect(orderStatusToneOf('Cancelled')).toBe('danger');
  });

  it('falls back to neutral for unknown or future values', () => {
    expect(orderStatusToneOf('Shipped')).toBe('neutral');
    expect(orderStatusToneOf('Refunding')).toBe('neutral');
    expect(orderStatusToneOf('')).toBe('neutral');
  });

  it('never maps payment-only values (cross-concept independence)', () => {
    expect(orderStatusToneOf('Succeeded')).toBe('neutral');
    expect(orderStatusToneOf('Failed')).toBe('neutral');
    expect(orderStatusToneOf('Processing')).toBe('neutral');
    expect(orderStatusToneOf('Refunded')).toBe('neutral');
  });
});

describe('paymentStatusToneOf', () => {
  it('resolves known payment statuses to their tones', () => {
    expect(paymentStatusToneOf('Pending')).toBe('info');
    expect(paymentStatusToneOf('Processing')).toBe('info');
    expect(paymentStatusToneOf('Succeeded')).toBe('success');
    expect(paymentStatusToneOf('Failed')).toBe('danger');
    expect(paymentStatusToneOf('Cancelled')).toBe('neutral');
    expect(paymentStatusToneOf('Refunded')).toBe('warning');
  });

  it('falls back to neutral for unknown or future values', () => {
    expect(paymentStatusToneOf('Reversed')).toBe('neutral');
    expect(paymentStatusToneOf('')).toBe('neutral');
  });

  it('never maps order-only values (cross-concept independence)', () => {
    expect(paymentStatusToneOf('Confirmed')).toBe('neutral');
  });
});
