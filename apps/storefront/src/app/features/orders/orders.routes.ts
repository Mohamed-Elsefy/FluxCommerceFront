import type { Routes } from '@angular/router';

/**
 * Storefront Orders feature routes (Sub-Phases 10.1–10.2 — Orders
 * Contract Audit & Feature Foundation, Customer Account & Profile).
 *
 * Scope: boundary placeholder — the route table stays empty until §10.3
 * builds the orders list page.
 *
 * Mounted under `account/orders` via `./account.routes` (the §10.2
 * account shell — guarded, with the feature-scoped `AccountState`).
 * Intended entries (proposed — §§10.3–10.4 and §10.7 finalize):
 *
 * ```text
 * /account/orders           → Orders list (§10.3)
 * /account/orders/:orderId  → Order details (§10.4)
 * ```
 *
 * Architectural flow (target — `ARCHITECTURE.md` §10; data access landed
 * in §10.1, account shell and profile in §10.2, orders state and pages
 * later):
 *
 * ```text
 * OrdersPage / OrderDetailsPage (pages/ — §§10.3–10.4)
 *     ↓ OrdersState (state/ — route-provided local Signals)
 *     ↓ OrdersApiService (data-access/ — §10.1 thin typed façade)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Orders API
 * ```
 */
export const ordersRoutes: Routes = [];
