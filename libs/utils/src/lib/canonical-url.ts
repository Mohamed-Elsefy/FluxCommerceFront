/**
 * Canonical-URL helper for Sub-Phase 11.3 — SEO Metadata.
 *
 * Sets (or creates, exactly once) the document `<link rel="canonical">`
 * tag. Shared by every SEO-sensitive public page (home, catalog listing,
 * product details) so canonical handling stays consistent instead of being
 * reimplemented per feature.
 *
 * Design notes:
 * - Pure function over an explicit `Document` — the caller injects
 *   `DOCUMENT` (SSR-safe on both platforms; no `window` access anywhere
 *   here), so this file has no Angular DI imports and stays trivially
 *   unit-testable.
 * - Idempotent: repeated calls update the single tag in place, so metadata
 *   effects that re-run on query/culture/resource changes can never
 *   duplicate the tag (Phase 11 §11.3 "not duplicated incorrectly").
 * - App-relative (`href="/catalog/…"`) by design: an absolute origin is not
 *   knowable SSR-safely without deployment configuration (the server
 *   document has no deployment host), and a wrong absolute origin is worse
 *   than a relative reference, which crawlers resolve against the document
 *   base. Absolute canonical origins belong to deployment configuration
 *   (Phase 11 §11.12/§11.13), never to page code.
 */

/** Selector for the single canonical link tag. */
export const CANONICAL_LINK_SELECTOR = 'link[rel="canonical"]';

/**
 * Sets the canonical URL to `href` (blank values fall back to `/`).
 * Creates the tag when absent; updates it in place when present.
 * Never throws for missing `head` — without a head there is nowhere
 * meaningful to publish metadata.
 */
export function setCanonicalUrl(document: Document, href: string): void {
  const normalized = href.trim() === '' ? '/' : href.trim();
  const head = document.head;
  if (!head) {
    return;
  }
  let link = head.querySelector<HTMLLinkElement>(CANONICAL_LINK_SELECTOR);
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    head.appendChild(link);
  }
  link.setAttribute('href', normalized);
}
