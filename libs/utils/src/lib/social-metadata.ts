/**
 * Social-image selection for Sub-Phase 11.4 — OpenGraph & Social Metadata.
 *
 * Shared by every SEO-sensitive public page so product, listing, and home
 * surfaces resolve their `og:image` identically. Pure data logic over an
 * explicit structural input — no Angular, DOM, or storage access, so this
 * file is SSR-safe and trivially unit-testable.
 *
 * Selection policy (mirrors the gallery precedence in
 * `product-gallery.ts`, minus transient UI state — metadata must reflect
 * content, never a thumbnail click):
 * - the first usable backend-primary image wins;
 * - otherwise the first usable image (wire order is `displayOrder`);
 * - otherwise the bundled fallback (`FALLBACK_SOCIAL_IMAGE`).
 *
 * "Usable" means a non-blank URL. Blank/broken URLs can never reach
 * `og:image`: scrapers cache aggressively, so a broken social image would
 * persist long after the page heals. Callers additionally pass an empty
 * list for failed/unknown resources (e.g. a 404 product whose image slot
 * happens to hold data), so error pages never present product imagery as
 * their own (Phase 11 §11.4 "no misleading metadata").
 *
 * Refactoring Phase A (step A2): the structural input is canonicalized
 * in `@flux/models` (`ImageCandidate`); this alias stays as the single
 * compat entry point so existing `@flux/utils` consumers keep working.
 */

import type { ImageCandidate } from '@flux/models';

/** Bundled fallback social image (served from the storefront `public/` dir). */
export const FALLBACK_SOCIAL_IMAGE = '/og-fallback.png';

/**
 * Structural image input — alias of the canonical `ImageCandidate` in
 * `@flux/models` (satisfied by any backend image shape). Kept for
 * backward compatibility; new code should prefer `ImageCandidate`.
 */
export type SocialImageCandidate = ImageCandidate;

/**
 * Resolves the `og:image` URL for `images`, falling back to
 * `FALLBACK_SOCIAL_IMAGE` when no usable backend URL exists. Pure and
 * total — never throws.
 */
export function selectSocialImage(
  images: readonly SocialImageCandidate[],
  fallback: string = FALLBACK_SOCIAL_IMAGE,
): string {
  const usable = images.filter((image) => image.imageUrl.trim() !== '');
  return usable.find((image) => image.isPrimary)?.imageUrl ?? usable[0]?.imageUrl ?? fallback;
}
