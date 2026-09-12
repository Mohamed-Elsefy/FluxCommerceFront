/**
 * Unit tests for the Sub-Phase 6.1–6.2 product-details feature models.
 *
 * Covers the pure helpers only (route-parameter extraction/trimming/
 * GUID-shape validation, not-found detection). The contract mirrors
 * themselves live in `@flux/models` (already covered by Phase 1 specs) and
 * are aliased here — never re-declared.
 */

import { describe, expect, it } from 'vitest';
import { ApiError } from '@flux/api';
import {
  PRODUCT_DETAILS_ID_PARAM,
  isNotFoundError,
  parseProductIdParam,
} from './product-details.models';

const VALID_ID = '11111111-1111-1111-1111-111111111111';

describe('PRODUCT_DETAILS_ID_PARAM', () => {
  it('names the :id route parameter', () => {
    expect(PRODUCT_DETAILS_ID_PARAM).toBe('id');
  });
});

describe('parseProductIdParam', () => {
  it('accepts a well-formed product id', () => {
    expect(parseProductIdParam(VALID_ID)).toBe(VALID_ID);
  });

  it('accepts uppercase GUID wire values', () => {
    expect(parseProductIdParam(VALID_ID.toUpperCase())).toBe(VALID_ID.toUpperCase());
  });

  it('trims surrounding whitespace before validating', () => {
    expect(parseProductIdParam(`  ${VALID_ID}  `)).toBe(VALID_ID);
  });

  it('rejects missing ids without throwing', () => {
    expect(parseProductIdParam(null)).toBeNull();
    expect(parseProductIdParam(undefined)).toBeNull();
  });

  it('rejects blank ids without throwing', () => {
    expect(parseProductIdParam('')).toBeNull();
    expect(parseProductIdParam('   ')).toBeNull();
  });

  it('rejects malformed ids without throwing', () => {
    expect(parseProductIdParam('not-a-product')).toBeNull();
    expect(parseProductIdParam('11111111-1111-1111-1111')).toBeNull();
    expect(parseProductIdParam('11111111-1111-1111-1111-11111111111g')).toBeNull();
  });
});

describe('isNotFoundError', () => {
  it('detects 404 failures as not-found', () => {
    expect(isNotFoundError(new ApiError({ status: 404, message: 'Not found.' }))).toBe(true);
  });

  it('rejects non-404 failures without throwing', () => {
    expect(isNotFoundError(new ApiError({ status: 400, message: 'Bad request.' }))).toBe(false);
    expect(isNotFoundError(new ApiError({ status: 500, message: 'Server error.' }))).toBe(false);
  });

  it('treats missing errors as not-a-not-found', () => {
    expect(isNotFoundError(null)).toBe(false);
    expect(isNotFoundError(undefined)).toBe(false);
  });
});
