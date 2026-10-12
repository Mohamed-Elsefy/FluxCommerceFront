import { describe, expect, it } from 'vitest';
import { hasUsableImageUrl, isImageCandidate } from './image';

describe('shared image candidate (Refactoring Phase A)', () => {
  it('narrows structural image values', () => {
    expect(isImageCandidate({ imageUrl: 'https://cdn/tee.jpg', isPrimary: true })).toBe(true);
    expect(isImageCandidate({ imageUrl: '', isPrimary: false })).toBe(true);
    expect(isImageCandidate({ imageUrl: 'x' })).toBe(false);
    expect(isImageCandidate(null)).toBe(false);
    expect(isImageCandidate(undefined)).toBe(false);
  });

  it('rejects blank urls as unusable', () => {
    expect(hasUsableImageUrl({ imageUrl: 'https://cdn/tee.jpg', isPrimary: false })).toBe(true);
    expect(hasUsableImageUrl({ imageUrl: '   ', isPrimary: true })).toBe(false);
    expect(hasUsableImageUrl({ imageUrl: '', isPrimary: false })).toBe(false);
    expect(hasUsableImageUrl(null)).toBe(false);
    expect(hasUsableImageUrl(undefined)).toBe(false);
  });
});
