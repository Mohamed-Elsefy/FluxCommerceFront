/**
 * Feature-owned users list state for Supplement S1, Step S1.5 — Admin
 * Users & Permissions (list slice).
 *
 * Scope: the paged users table only (`GET /admin/users` — paging plus
 * `status`/`role`/`search` filters, fixed newest-first; no sorting —
 * see the S1.1 audit). Filter transitions commit through the explicit
 * `setFilters()` (page resets to 1); page moves commit through
 * `setPage()`.
 *
 * Display contract (S1.1 audit — only backend-exposed data): rows carry
 * the `UserAdminResponse` payloads verbatim (identity, roles, status,
 * lockout telemetry, permissions). No derivation, no role inference.
 *
 * Locality rules (same convention as the orders states):
 * `@Injectable()` WITHOUT `providedIn` (route-level providers only),
 * local Signals via `createResourceState`, no `HttpClient`, no query
 * strings, envelopes unwrap here, dataless envelopes resolve to `error`.
 * Pager values always render from the RESPONSE envelope (effective
 * `pageNumber`/`pageSize`/`totalCount`) — never request values. CSR-safe:
 * no browser APIs anywhere in this file.
 *
 * Transport note: list reads go through the shared `IdentityApiService`
 * (`@flux/api`, S1.2) directly — no feature façade duplicates a thin
 * typed transport that already exists (rules 12.11/Phase-12: no parallel
 * admin transport).
 *
 * Explicitly out of scope (later slices, must not appear here):
 * - counts overview, user details, permission grant/revoke.
 */

import { inject, Injectable, OnDestroy, type Signal } from '@angular/core';
import { map, Subscription, type Observable } from 'rxjs';
import {
  ApiError,
  IdentityApiService,
  createResourceState,
  loadResourceState,
  UNKNOWN_ERROR_CODE,
  type ApiResponseWithData,
  type PagedApiResponse,
  type ResourceState,
  type ResourceStateStore,
} from '@flux/api';
import type { UserAdminResponse, UserListQuery } from '@flux/models';
import type { UserAdminPage } from '../models/users-admin.models';

/** Default list page size (within the contract `1..100` limits). */
export const USER_LIST_PAGE_SIZE = 20;

/** Committed list query (paging plus contract-supported filters). */
export interface UsersListQuery extends UserListQuery {
  readonly pageNumber?: number;
  readonly pageSize?: number;
}

/**
 * Feature-scoped users list state. Provide at the users route level —
 * never at root. All selectors are readonly signals; filter and page
 * moves commit through the explicit setters driven by the owning page.
 */
@Injectable()
export class UsersListState implements OnDestroy {
  private readonly identity = inject(IdentityApiService);
  private loads = new Subscription();

  private readonly pageStore: ResourceStateStore<UserAdminPage> =
    createResourceState<UserAdminPage>();

  /** Current user page (idle → loading → success | empty | error). */
  readonly page: Signal<ResourceState<UserAdminPage>> = this.pageStore.state;

  /** Currently committed filters (page moves preserve them). */
  private committed: UsersListQuery = {};

  /**
   * Loads the given page under the committed filters (response-effective
   * values drive the pager, so callers pass committed page numbers
   * only). A load issued while another is in flight supersedes it: the
   * previous subscription is torn down first, so stale pages can never
   * settle over newer ones. Empty strings travel as omissions (the
   * backend `400`s on empty filter values — structural pre-checks, never
   * substitutes for backend validation).
   */
  load(query: UsersListQuery = {}): void {
    this.loads.unsubscribe();
    this.loads = new Subscription();
    this.committed = { ...this.committed, ...query };
    const { pageNumber, pageSize, ...filters } = this.committed;
    const request: Observable<UserAdminPage> = this.identity
      .listUsers({
        pageNumber: pageNumber ?? 1,
        pageSize: pageSize ?? USER_LIST_PAGE_SIZE,
        ...omitBlankFilters(filters),
      })
      .pipe(map(requireUserPage));
    this.loads.add(
      loadResourceState(this.pageStore, request, {
        isEmpty: (page) => page.items.length === 0,
      }),
    );
  }

  /**
   * Commits new filters (filter-bar apply/clear re-enter here). The page
   * resets to 1: filtered result sets never preserve the old page.
   * Filters replace (never merge): omitted keys are cleared so
   * `clearFilters()` really reloads unfiltered. The page size survives.
   */
  setFilters(filters: Omit<UsersListQuery, 'pageNumber' | 'pageSize'>): void {
    const { pageSize } = this.committed;
    this.committed = {};
    this.load({ ...filters, pageNumber: 1, ...(pageSize === undefined ? {} : { pageSize }) });
  }

  /**
   * Commits a page move (pager `pageChange` re-enters here). Out-of-range
   * pages arrive as `200` with `items: []` — the page renders its empty
   * state, never an error.
   */
  setPage(pageNumber: number): void {
    this.load({ pageNumber });
  }

  /** Reloads the current effective page (retry and post-action refresh). */
  reload(): void {
    const current = this.pageStore.data();
    this.load(current === null ? {} : { pageNumber: current.pageNumber });
  }

  ngOnDestroy(): void {
    this.loads.unsubscribe();
  }
}

/** Drops blank filter values (the backend rejects empty strings). */
function omitBlankFilters(
  filters: Omit<UsersListQuery, 'pageNumber' | 'pageSize'>,
): Omit<UsersListQuery, 'pageNumber' | 'pageSize'> {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === 'string' && value.trim() !== '') {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/** Unwraps a paged envelope; a dataless `200` is a contract violation. */
function requireUserPage(envelope: PagedApiResponse<UserAdminResponse>): UserAdminPage {
  const data = (envelope as ApiResponseWithData<UserAdminPage>).data;
  if (data === undefined || data === null) {
    throw new ApiError({
      status: 200,
      code: UNKNOWN_ERROR_CODE,
      message: 'The server returned an empty response.',
    });
  }
  return data;
}
