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
import { VariantStatus } from '@flux/models';
import type { ProductVariant } from './product-details.models';
import {
  PRODUCT_DETAILS_ID_PARAM,
  isNotFoundError,
  isSelectableVariant,
  parseProductIdParam,
  resolveVariantSelection,
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

const ACTIVE_VARIANT: ProductVariant = {
  id: 'aaaaaaaa-1111-4111-8111-111111111111',
  productId: '11111111-1111-1111-1111-111111111111',
  sku: 'TEE-RED-M',
  name: 'Red / M',
  status: VariantStatus.Active,
  isDeleted: false,
  createdAtUtc: '2026-09-04T10:00:00Z',
  deletedAtUtc: null,
};

const INACTIVE_VARIANT: ProductVariant = {
  ...ACTIVE_VARIANT,
  id: 'bbbbbbbb-2222-4222-8222-222222222222',
  sku: 'TEE-BLUE-M',
  name: 'Blue / M',
  status: VariantStatus.Inactive,
};

const DELETED_VARIANT: ProductVariant = {
  ...ACTIVE_VARIANT,
  id: 'cccccccc-3333-4333-8333-333333333333',
  sku: 'TEE-GREEN-M',
  name: 'Green / M',
  isDeleted: true,
};

describe('isSelectableVariant', () => {
  it('accepts active, non-deleted variants', () => {
    expect(isSelectableVariant(ACTIVE_VARIANT)).toBe(true);
  });

  it('rejects inactive variants', () => {
    expect(isSelectableVariant(INACTIVE_VARIANT)).toBe(false);
  });

  it('rejects soft-deleted variants', () => {
    expect(isSelectableVariant(DELETED_VARIANT)).toBe(false);
  });
});

describe('resolveVariantSelection', () => {
  const variants = [ACTIVE_VARIANT, INACTIVE_VARIANT, DELETED_VARIANT];

  it('resolves a selectable variant id', () => {
    expect(resolveVariantSelection(variants, ACTIVE_VARIANT.id)).toBe(ACTIVE_VARIANT.id);
  });

  it('rejects unknown ids without throwing', () => {
    expect(resolveVariantSelection(variants, 'dddddddd-4444-4444-8444-444444444444')).toBeNull();
  });

  it('rejects inactive and deleted variants without throwing', () => {
    expect(resolveVariantSelection(variants, INACTIVE_VARIANT.id)).toBeNull();
    expect(resolveVariantSelection(variants, DELETED_VARIANT.id)).toBeNull();
  });

  it('rejects missing, blank, and unloaded inputs without throwing', () => {
    expect(resolveVariantSelection(variants, null)).toBeNull();
    expect(resolveVariantSelection(variants, undefined)).toBeNull();
    expect(resolveVariantSelection(variants, '   ')).toBeNull();
    expect(resolveVariantSelection(null, ACTIVE_VARIANT.id)).toBeNull();
    expect(resolveVariantSelection(undefined, ACTIVE_VARIANT.id)).toBeNull();
    expect(resolveVariantSelection([], ACTIVE_VARIANT.id)).toBeNull();
  });
});
