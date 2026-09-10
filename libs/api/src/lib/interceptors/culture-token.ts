/**
 * Culture integration seam for Sub-Phase 1.4 — HTTP Interceptor Pipeline,
 * activated in Sub-Phase 4.5 — Backend Culture Synchronization.
 *
 * Scope: `docs/phases/PHASE_4_LOCALIZATION_AND_CULTURE_MANAGEMENT.md` §4.5
 * ("Propagate the current frontend culture consistently to the FluxCommerce
 * backend through the existing HTTP/request infrastructure").
 *
 * This file exposes a single seam — a synchronous active-culture reader —
 * so `requestConfigInterceptor` (./request-config-interceptor) can attach
 * `Accept-Language` WITHOUT owning any culture state. Culture resolution,
 * persistence, switching, and direction belong exclusively to Phase 4,
 * which overrides this provider with its `CultureService`-backed
 * implementation:
 *
 * ```text
 * Phase 4: { provide: ACTIVE_CULTURE_PROVIDER, useFactory: (service) => () => service.culture(), ... }
 * ```
 *
 * Until then the root default returns `null` and the interceptor stays
 * inert for culture (requests carry no `Accept-Language` unless the caller
 * supplied one per-request — the backend default `en` applies).
 */

import { InjectionToken } from '@angular/core';
import type { SupportedCulture } from '../contracts/api-headers';

/** Synchronous reader for the active frontend culture, or `null` when absent. */
export type ActiveCultureProvider = () => SupportedCulture | null;

/**
 * Integration hook for the request-configuration interceptor. Overridden by
 * Phase 4 with a `CultureService`-backed reader; defaults to `() => null`
 * (no ambient culture).
 */
export const ACTIVE_CULTURE_PROVIDER = new InjectionToken<ActiveCultureProvider>(
  'ACTIVE_CULTURE_PROVIDER',
  { providedIn: 'root', factory: () => () => null },
);
