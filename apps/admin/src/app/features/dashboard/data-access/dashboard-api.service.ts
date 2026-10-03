/**
 * Admin Dashboard data-access service for Supplement S1, Step S1.10 —
 * Admin Dashboard (Real API).
 *
 * Scope: the single `[Route admin/dashboard]` read (read-only snapshot
 * composing the per-module overviews; the host never touches another
 * module's state — each section is produced by its owning module
 * server-side).
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §8
 * (`dashboard.read`; negative `lowStockThreshold` → `400
 * ValidationFailed`; first failing section's error surfaces).
 *
 * Layering (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * DashboardState (../state, route-provided)
 *         ↓ DashboardApiService (this file — thin typed façade)
 *     ApiClient (Phase 1, the ONLY HttpClient user)
 *         ↓ HttpClient → interceptors → ASP.NET Core API
 * ```
 *
 * Contract fidelity rules enforced here (same convention as
 * `PaymentsAdminApiService`):
 * - Request/response types come from `@flux/models` — no local
 *   re-declarations, so no contract drift is possible.
 * - Route templates come from `DASHBOARD_ENDPOINTS` — no scattered
 *   string literals.
 * - Query objects convert through the single `toQueryParams` funnel —
 *   never hand-built query strings.
 * - The service never unwraps `ApiResponse.data`, never catches or
 *   remaps errors, and never attaches tokens: envelopes stay intact
 *   for feature state to map, failures flow untouched to the Phase 1
 *   error normalizer, and `Authorization` stays owned by the
 *   interceptor pipeline.
 *
 * Explicitly out of scope (must not appear here):
 * - Per-module drilling (the snapshot sections link to the owning
 *   feature lists — `/orders/list`, `/payments/list`,
 *   `/inventory/stock`, `/users/list` — no parallel reads here).
 * - No totals math, no status derivation.
 */

import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { AdminDashboardResponse, DashboardQuery } from '@flux/models';
import {
  ApiClient,
  DASHBOARD_ENDPOINTS,
  toQueryParams,
  type ApiRequestOptions,
  type ApiResponseWithData,
} from '@flux/api';

/**
 * Thin typed façade over the admin Dashboard contract. One method maps
 * 1:1 to the single endpoint (same params, same envelope); there is no
 * mapping here because feature state owns envelope handling.
 *
 * Feature-scoped (no `providedIn`): provided on the dashboard route
 * alongside the dashboard state — never a root singleton (Phase 12.8
 * pins the root-provided admin allowlist; this service is not on it).
 */
@Injectable()
export class DashboardApiService {
  private readonly api = inject(ApiClient);

  /**
   * `GET /admin/dashboard` — read-only snapshot of the per-module
   * overviews plus the newest 5 orders. `lowStockThreshold` defaults to
   * 5 server-side (inclusive available ceiling for the inventory
   * section); negative values → `400 ValidationFailed`.
   * Success: `200 ApiResponse<AdminDashboardResponse>`.
   * Failures: `400` validation, `401` anonymous, `403` missing
   * `dashboard.read` (first failing section's error surfaces as
   * mapped).
   */
  getDashboard(
    query: DashboardQuery = {},
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<AdminDashboardResponse>> {
    return this.api.get<ApiResponseWithData<AdminDashboardResponse>>(
      DASHBOARD_ENDPOINTS.getDashboard.path,
      { ...options, params: toQueryParams(query) },
    );
  }
}
