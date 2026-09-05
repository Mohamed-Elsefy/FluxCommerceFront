import { describe, expect, it } from 'vitest';
import { isDefined } from './guards';

describe('isDefined', () => {
  it('keeps defined values and narrows away null and undefined', () => {
    expect(isDefined('a')).toBe(true);
    expect(isDefined(0)).toBe(true);
    expect(isDefined(null)).toBe(false);
    expect(isDefined(undefined)).toBe(false);
  });

  it('filters nullable entries out of arrays', () => {
    expect(['a', null, 'b', undefined].filter(isDefined)).toEqual(['a', 'b']);
  });
});
