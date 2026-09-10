/**
 * Culture propagation wiring for Sub-Phase 4.5 — Backend Culture Synchronization.
 *
 * Activates the Phase 1 `ACTIVE_CULTURE_PROVIDER` seam
 * (`libs/api/.../interceptors/culture-token.ts`) with the
 * `CultureService`-backed reader it was designed for:
 *
 * ```text
 * CultureService (active culture signal, Sub-Phase 4.3)
 *     ↓ culture()
 * ACTIVE_CULTURE_PROVIDER (Phase 1 seam, overridden here)
 *     ↓ requestConfigInterceptor (Phase 1, extended in 4.5)
 * Accept-Language: <culture> (explicit per-request context still wins)
 * ```
 *
 * Behavior:
 * - Every API request carries the active culture — no feature code attaches
 *   headers and neither application manages propagation manually.
 * - The reader is evaluated per request, so a runtime `setCulture(...)`
 *   affects subsequent requests (including 401-recovery retries, which
 *   re-enter the pipeline) without restarts.
 * - Explicit per-request `culture` context and directly set
 *   `Accept-Language` headers are never clobbered (the interceptor checks
 *   first).
 *
 * Registration: applications call `provideCulturePropagation()` once next to
 * `provideApi()` and `provideCulture()` (storefront `app.config.ts`, admin
 * `app.config.ts`; the SSR server config inherits it via
 * `mergeApplicationConfig`). Tests override `ACTIVE_CULTURE_PROVIDER` (or
 * drive `CultureService`) the same way Phase 1 specs do.
 *
 * Explicitly out of scope (later sub-phases, must not appear here):
 * - 4.6 — no date/number/currency formatting.
 * - 4.7 — no API error-code localization mapping.
 */

import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { ACTIVE_CULTURE_PROVIDER } from '@flux/api';
import { CultureService } from './culture.service';

/**
 * Overrides the Phase 1 inert default (`() => null`) with a reader bound to
 * the central `CultureService`. Call once per application bootstrap.
 */
export function provideCulturePropagation(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: ACTIVE_CULTURE_PROVIDER,
      useFactory: (service: CultureService) => () => service.culture(),
      deps: [CultureService],
    },
  ]);
}
