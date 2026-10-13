/**
 * Shared image-candidate model for Refactoring Phase A (step A2).
 *
 * Canonical structural shape behind the SEO image input
 * (`SocialImageCandidate` in `@flux/utils/social-metadata`) and every
 * backend image summary (`CatalogImageSummary`, `ProductImageResponse`).
 * Satisfied by any backend image shape — no import of catalog contracts
 * needed. Pure types only — no Angular, no HTTP, SSR-safe.
 */

/** Structural image input — satisfied by any backend image shape. */
export interface ImageCandidate {
  readonly imageUrl: string;
  readonly isPrimary: boolean;
}

/**
 * Whether `value` has the structural image shape. Pure — throws
 * nothing.
 */
export function isImageCandidate(value: unknown): value is ImageCandidate {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<ImageCandidate>;
  return typeof candidate.imageUrl === 'string' && typeof candidate.isPrimary === 'boolean';
}

/**
 * Whether the candidate carries a usable (non-blank) URL. Blank URLs
 * can never reach `og:image` — scrapers cache aggressively. Pure.
 */
export function hasUsableImageUrl(candidate: ImageCandidate | null | undefined): boolean {
  if (candidate === null || candidate === undefined) {
    return false;
  }
  return candidate.imageUrl.trim() !== '';
}
