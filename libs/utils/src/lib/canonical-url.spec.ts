import { describe, expect, it } from 'vitest';
import { CANONICAL_LINK_SELECTOR, setCanonicalUrl } from './canonical-url';

describe('setCanonicalUrl', () => {
  it('creates the canonical link tag when absent', () => {
    document.head.querySelector(CANONICAL_LINK_SELECTOR)?.remove();

    setCanonicalUrl(document, '/catalog');

    const links = document.head.querySelectorAll(CANONICAL_LINK_SELECTOR);
    expect(links.length).toBe(1);
    expect(links[0]?.getAttribute('href')).toBe('/catalog');
  });

  it('updates the single tag in place instead of duplicating it', () => {
    setCanonicalUrl(document, '/');
    setCanonicalUrl(document, '/catalog/products/abc');
    setCanonicalUrl(document, '/catalog?categoryId=xyz');

    const links = document.head.querySelectorAll(CANONICAL_LINK_SELECTOR);
    expect(links.length).toBe(1);
    expect(links[0]?.getAttribute('href')).toBe('/catalog?categoryId=xyz');
  });

  it('falls back to the home path for blank values', () => {
    setCanonicalUrl(document, '   ');

    expect(document.head.querySelector(CANONICAL_LINK_SELECTOR)?.getAttribute('href')).toBe('/');
  });
});
