import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  ApiError,
  NETWORK_ERROR_CODE,
  REQUEST_CANCELLED_CODE,
  UNKNOWN_ERROR_CODE,
  isApiError,
  normalizeHttpError,
  normalizeUnknownError,
} from './error-normalizer';

function httpError(init: {
  status: number;
  statusText?: string;
  body?: unknown;
}): HttpErrorResponse {
  return new HttpErrorResponse({
    status: init.status,
    statusText: init.statusText ?? 'Error',
    error: init.body ?? null,
    url: 'https://localhost:7119/orders/missing',
  });
}

describe('normalizeHttpError', () => {
  it('parses a business ProblemDetail without inventing a code', () => {
    const error = normalizeHttpError(
      httpError({
        status: 404,
        statusText: 'Not Found',
        body: {
          type: 'https://tools.ietf.org/html/rfc7231#section-6.5.4',
          title: 'Not Found',
          status: 404,
          detail: 'Commande introuvable.',
          traceId: 'trace-1',
          extensions: {},
        },
      }),
      'flow-1',
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(404);
    expect(error.code).toBeUndefined();
    expect(error.message).toBe('Commande introuvable.');
    expect(error.validationErrors).toBeUndefined();
    expect(error.correlationId).toBe('flow-1');
    expect(error.traceId).toBe('trace-1');
  });

  it('captures extensions.code when a backend sends one', () => {
    const error = normalizeHttpError(
      httpError({
        status: 409,
        body: { status: 409, detail: 'Conflict.', extensions: { code: 'Order.CancelConflict' } },
      }),
    );

    expect(error.code).toBe('Order.CancelConflict');
    expect(error.message).toBe('Conflict.');
    expect(error.correlationId).toBeNull();
  });

  it('coerces the 400 validation errors map', () => {
    const error = normalizeHttpError(
      httpError({
        status: 400,
        body: {
          status: 400,
          detail: 'Validation failed.',
          errors: { Quantity: ['Quantity must be at least 1.', 42], Email: 'not-an-array' },
        },
      }),
    );

    expect(error.status).toBe(400);
    expect(error.code).toBeUndefined();
    expect(error.validationErrors).toEqual({
      Quantity: ['Quantity must be at least 1.'],
      Email: [],
    });
  });

  it('normalizes 401 Unauthorized without inventing auth behavior', () => {
    const error = normalizeHttpError(
      httpError({
        status: 401,
        statusText: 'Unauthorized',
        body: {
          type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
          title: 'Unauthorized',
          status: 401,
          detail: 'Invalid credentials.',
          traceId: 'trace-401',
          extensions: {},
        },
      }),
    );

    expect(error.status).toBe(401);
    expect(error.code).toBeUndefined();
    expect(error.message).toBe('Invalid credentials.');
    expect(error.validationErrors).toBeUndefined();
    expect(error.traceId).toBe('trace-401');
  });

  it('falls back to technical messages for non-problem bodies', () => {
    const stringBody = normalizeHttpError(httpError({ status: 502, body: '<html>proxy</html>' }));
    expect(stringBody.message).toBe('<html>proxy</html>');
    expect(stringBody.code).toBeUndefined();

    const emptyBody = normalizeHttpError(httpError({ status: 500, statusText: 'Server Error' }));
    expect(emptyBody.message).toBe('Request failed with status 500 (Server Error).');
  });

  it('maps status-0 failures to NetworkError', () => {
    const error = normalizeHttpError(
      httpError({ status: 0, body: new ProgressEvent('error') }),
      'flow-9',
    );

    expect(error.status).toBe(0);
    expect(error.code).toBe(NETWORK_ERROR_CODE);
    expect(error.message).toContain('Http failure response');
    expect(error.correlationId).toBe('flow-9');
  });

  it('classifies aborts as cancellations, not failures', () => {
    const error = normalizeHttpError(httpError({ status: 0, body: { name: 'AbortError' } }));

    expect(error.status).toBe(0);
    expect(error.code).toBe(REQUEST_CANCELLED_CODE);
  });
});

describe('normalizeUnknownError', () => {
  it('passes ApiError through untouched (no double mapping)', () => {
    const original = new ApiError({ status: 409, message: 'Conflict.' });
    expect(normalizeUnknownError(original)).toBe(original);
  });

  it('maps unexpected Error throwables with their message', () => {
    const error = normalizeUnknownError(new Error('Pipeline blew up.'));
    expect(error.status).toBe(0);
    expect(error.code).toBe(UNKNOWN_ERROR_CODE);
    expect(error.message).toBe('Pipeline blew up.');
  });

  it('maps non-Error throwables to a generic diagnostic', () => {
    const error = normalizeUnknownError('boom');
    expect(error.status).toBe(0);
    expect(error.code).toBe(UNKNOWN_ERROR_CODE);
    expect(error.message).toBe('An unexpected error occurred.');
  });
});

describe('isApiError', () => {
  it('narrows normalized errors only', () => {
    expect(isApiError(new ApiError({ status: 404, message: 'x' }))).toBe(true);
    expect(isApiError(new Error('x'))).toBe(false);
    expect(isApiError({ status: 404 })).toBe(false);
    expect(isApiError(null)).toBe(false);
  });
});
