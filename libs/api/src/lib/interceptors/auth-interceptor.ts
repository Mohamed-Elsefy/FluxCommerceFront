/**
 * Authentication integration interceptor for Sub-Phase 1.4 — HTTP Interceptor Pipeline.
 *
 * Scope: `docs/phases/PHASE_1_CORE_INFRASTRUCTURE.md` §1.4
 * ("Authentication integration hooks") with the Phase 1 boundary that NO
 * authentication workflow lives here.
 *
 * Single responsibility: attach `Authorization: Bearer <token>` when a token
 * is available via `ACCESS_TOKEN_PROVIDER` (./auth-token). Rules:
 *
 * - Never clobbers an explicitly set `Authorization` header.
 * - Adds nothing when the provider returns `null`/empty (default until
 *   Phase 2 overrides the provider — the interceptor is inert for anonymous
 *   traffic such as catalog reads and guest carts).
 * - Backend scope only (11.12): absolute URLs outside the configured
 *   `API_BASE_URL` never receive the token, so a future third-party
 *   `HttpClient` call cannot leak the session. Relative (same-origin)
 *   URLs stay attached — they address the backend by construction.
 * - Performs no token acquisition, storage, refresh, retry, or redirect —
 *   all Phase 2 responsibilities.
 *
 * Runs FOURTH in `API_INTERCEPTORS` (after context/correlation stamping, as
 * the last header mutation before transport).
 */

import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { API_BASE_URL } from '../client/api-base-url';
import { ACCESS_TOKEN_PROVIDER } from './auth-token';

/** Absolute HTTP(S) URLs, e.g. third-party endpoints (never backend-relative). */
const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

/**
 * Attaches the Bearer token for backend traffic when one is available;
 * otherwise passes through. Third-party absolute URLs are never
 * authenticated.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.headers.has('Authorization')) {
    return next(req);
  }
  if (ABSOLUTE_URL_PATTERN.test(req.url) && !req.url.startsWith(inject(API_BASE_URL))) {
    return next(req);
  }
  const token = inject(ACCESS_TOKEN_PROVIDER)();
  if (!token) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
