import { describe, expect, it } from 'vitest';
import {
  FALLBACK_SOCIAL_IMAGE,
  selectSocialImage,
  type SocialImageCandidate,
} from './social-metadata';

function candidate(imageUrl: string, isPrimary = false): SocialImageCandidate {
  return { imageUrl, isPrimary };
}

describe('selectSocialImage', () => {
  it('prefers the backend-primary image over wire order', () => {
    expect(
      selectSocialImage([
        candidate('https://cdn.example/first.png'),
        candidate('https://cdn.example/primary.png', true),
      ]),
    ).toBe('https://cdn.example/primary.png');
  });

  it('falls back to the first usable image without a primary', () => {
    expect(
      selectSocialImage([
        candidate('https://cdn.example/first.png'),
        candidate('https://cdn.example/second.png'),
      ]),
    ).toBe('https://cdn.example/first.png');
  });

  it('skips blank URLs and uses the bundled fallback when nothing is usable', () => {
    expect(selectSocialImage([candidate('   '), candidate('')])).toBe(FALLBACK_SOCIAL_IMAGE);
    expect(selectSocialImage([])).toBe(FALLBACK_SOCIAL_IMAGE);
  });
});
