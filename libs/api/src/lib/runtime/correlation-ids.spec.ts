import { HttpHeaders } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  CORRELATION_ID_HEADER,
  REQUEST_ID_HEADER,
  extractCorrelationId,
  newCorrelationId,
} from './correlation-ids';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('newCorrelationId', () => {
  it('generates UUID-shaped unique ids', () => {
    const first = newCorrelationId();
    const second = newCorrelationId();

    expect(first).toMatch(UUID_PATTERN);
    expect(second).toMatch(UUID_PATTERN);
    expect(first).not.toBe(second);
  });
});

describe('extractCorrelationId', () => {
  it('prefers the echoed correlation id over the request id', () => {
    const headers = new HttpHeaders({
      [CORRELATION_ID_HEADER]: 'flow-1',
      [REQUEST_ID_HEADER]: 'req-1',
    });

    expect(extractCorrelationId(headers)).toBe('flow-1');
  });

  it('falls back to the backend request id', () => {
    expect(extractCorrelationId(new HttpHeaders({ [REQUEST_ID_HEADER]: 'req-2' }))).toBe('req-2');
  });

  it('returns null when nothing is present', () => {
    expect(extractCorrelationId(new HttpHeaders())).toBeNull();
    expect(extractCorrelationId(null)).toBeNull();
    expect(extractCorrelationId(undefined)).toBeNull();
  });
});
