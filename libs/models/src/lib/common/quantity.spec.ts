import { describe, expect, it } from 'vitest';
import { isValidQuantity, MIN_QUANTITY, parseQuantityInput } from './quantity';

describe('shared purchase quantity (Refactoring Phase B)', () => {
  it('pins the contract quantity floor', () => {
    expect(MIN_QUANTITY).toBe(1);
  });

  it('accepts integers at or above the floor only', () => {
    expect(isValidQuantity(1)).toBe(true);
    expect(isValidQuantity(99)).toBe(true);
    expect(isValidQuantity(0)).toBe(false);
    expect(isValidQuantity(-1)).toBe(false);
    expect(isValidQuantity(1.5)).toBe(false);
    expect(isValidQuantity(NaN)).toBe(false);
  });

  it('parses digits-only textbox text, rejecting everything else', () => {
    expect(parseQuantityInput('3')).toBe(3);
    expect(parseQuantityInput('  12  ')).toBe(12);
    expect(parseQuantityInput('')).toBeNull();
    expect(parseQuantityInput('   ')).toBeNull();
    expect(parseQuantityInput('0')).toBeNull();
    expect(parseQuantityInput('-2')).toBeNull();
    expect(parseQuantityInput('2.5')).toBeNull();
    expect(parseQuantityInput('2a')).toBeNull();
    expect(parseQuantityInput(null)).toBeNull();
    expect(parseQuantityInput(undefined)).toBeNull();
  });
});
