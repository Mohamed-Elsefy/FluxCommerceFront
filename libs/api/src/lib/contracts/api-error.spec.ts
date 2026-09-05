import { describe, expect, it } from 'vitest';
import {
  isValidationProblemDetail,
  problemCodeOf,
  type ProblemDetail,
  type ValidationProblemDetail,
} from './api-error';

function problem(overrides: Partial<ProblemDetail> = {}): ProblemDetail {
  return {
    type: 'https://tools.ietf.org/html/rfc7231#section-6.5.4',
    title: 'Not Found',
    status: 404,
    detail: 'Product not found.',
    ...overrides,
  };
}

describe('isValidationProblemDetail', () => {
  it('narrows 400 bodies carrying the errors map', () => {
    const body: ValidationProblemDetail = {
      ...problem(),
      type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
      title: 'Validation Failed',
      status: 400,
      detail: 'Validation failed.',
      errors: { Quantity: ['Quantity must be at least 1.'] },
    };

    expect(isValidationProblemDetail(body)).toBe(true);
  });

  it('rejects business errors, non-400 shapes, and non-objects', () => {
    expect(isValidationProblemDetail(problem())).toBe(false);
    expect(isValidationProblemDetail({ ...problem(), status: 400 })).toBe(false);
    expect(isValidationProblemDetail(null)).toBe(false);
    expect(isValidationProblemDetail('Not Found')).toBe(false);
  });
});

describe('problemCodeOf', () => {
  it('reads extensions.code when a backend sends one', () => {
    expect(problemCodeOf(problem({ extensions: { code: 'Catalog.DuplicateProductSlug' } }))).toBe(
      'Catalog.DuplicateProductSlug',
    );
  });

  it('returns undefined for wire-realistic empty extensions and non-objects', () => {
    expect(problemCodeOf(problem({ extensions: {} }))).toBeUndefined();
    expect(problemCodeOf(problem())).toBeUndefined();
    expect(problemCodeOf(problem({ extensions: { code: 42 } }))).toBeUndefined();
    expect(problemCodeOf(null)).toBeUndefined();
  });
});
