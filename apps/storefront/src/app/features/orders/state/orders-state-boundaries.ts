/**
 * Orders feature-state boundaries for Sub-Phases 10.1–10.4 — Orders
 * Contract Audit & Feature Foundation through Order Details.
 *
 * Scope: boundary shapes only — no `@Injectable()` store, no signals,
 * no effects, no polling implementation in this file. The §10.3 list
 * slot is implemented by `./orders-list-state` (`OrdersListState`,
 * route-provided via `ordersRoutes`) and the §10.4 details slot by
 * `./order-details-state` (`OrderDetailsState`, route-provided on the
 * `:orderId` entry); the shapes below remain the documented
 * data-access/state seam targets.
 *
 * Intended dependency flow (`ARCHITECTURE.md` §10), established here as
 * the contract that later sub-phases implement:
 *
 * ```text
 * Orders Page (10.3/10.4 — not this sub-phase)
 *     ↓ OrdersState (route-provided, feature-owned local Signals)
 *     ↓ OrdersApiService (../data-access — thin typed façade)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Orders API
 * ```
 *
 * State rules pinned here (same pattern as Catalog/Cart/Checkout/Payment
 * states — route-provided, never `providedIn`, never a global store):
 * - The list slot holds the settled `PagedResult<OrderSummary>` page plus
 *   the effective query (render pager state from RESPONSE-effective
 *   `pageNumber/pageSize/totalCount`, never request values).
 * - The details slot holds the settled `Order` plus the requested id.
 * - No cross-feature state: the account/profile area (§10.2) consumes
 *   the Phase 2 auth session read-only; orders state never writes it.
 * - No business logic in state: no totals math, no status derivation,
 *   no transitions — backend values render verbatim.
 * - Polling (§10.6) stays unbuilt until backend behavior proves it
 *   required (bounded, cancellable, no overlapping requests).
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 10.5 — no badge/label mapping state.
 * - 10.6 — no polling loops or sync state.
 */

import type { PagedResult } from '@flux/api';
import type { Order, OrderSummary, OrdersQuery } from '../models/orders.models';

/**
 * Intended orders-list state shape (§10.3 implements it in
 * `./orders-list-state`): the settled page plus the effective query
 * that produced it. Declared here so the data-access/state seam has one
 * typed target; no runtime lives here.
 */
export interface OrdersListStateShape {
  readonly page: PagedResult<OrderSummary> | null;
  readonly query: OrdersQuery;
}

/**
 * Intended order-details state shape (§10.4 implements it in
 * `./order-details-state`): the settled order plus the requested id.
 * Declared here so the data-access/state seam has one typed target; no
 * runtime lives here.
 */
export interface OrderDetailsStateShape {
  readonly order: Order | null;
  readonly orderId: string | null;
}
