/**
 * Unit tests for the Sub-Phase 6.1 product-details feature models.
 *
 * Covers the pure route-parameter helpers only (extraction, trimming,
 * GUID-shape validation). The contract mirror itself lives in
 * `@flux/models` (already covered by Phase 1 specs) and is aliased here —
 * never re-declared.
 */

import { describe, expect, it } from 'vitest';
import { PRODUCT_DETAILS_ID_PARAM, parseProductIdParam } from './product-details.models';

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
