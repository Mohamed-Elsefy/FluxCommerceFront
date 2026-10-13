/**
 * Feature-owned user details state for Supplement S1, Step S1.5 — Admin
 * Users & Permissions (details + permission slice).
 *
 * Scope: the single user read (`GET /admin/users/{id}`), the granted
 * permission list (`GET /admin/users/{id}/permissions`), and the full
 * permission catalog (`GET /admin/users/permissions`). Reads stay
 * independent: the permissions slot never hides settled user facts (and
 * vice versa) — the same independence rule as the 14.6 payment slot.
 * Grant/revoke submissions stay page-local (the owning page subscribes
 * through `IdentityApiService` directly, like the 13.10 adjustment
 * submission — notifications and dialog confirmation need the page
 * context, and no shared submission state justifies a store).
 *
 * Display contract (S1.1 audit — only backend-exposed data): identity,
 * roles, status, lockout telemetry, and permission values render
 * verbatim.
 *
 * Locality rules (same convention as the orders states):
 * `@Injectable()` WITHOUT `providedIn` (route-level providers only),
 * local Signals via `createResourceState`, no `HttpClient`, envelopes
 * unwrap here, dataless envelopes resolve to `error`. Route-param
 * effects live in the owning page (untracked, supersede-on-navigate).
 * CSR-safe: no browser APIs anywhere in this file.
 *
 * Transport note: reads go through the shared `IdentityApiService`
 * (`@flux/api`, S1.2) directly — no feature façade duplicates a thin
 * typed transport that already exists.
 */

import { inject, Injectable, OnDestroy, type Signal } from '@angular/core';
import { map, Subscription, type Observable } from 'rxjs';
import {
  ApiError,
  IdentityApiService,
  createResourceState,
  loadResourceState,
  UNKNOWN_ERROR_CODE,
  type ApiRequestOptions,
  type ApiResponseWithData,
  type ResourceState,
  type ResourceStateStore,
} from '@flux/api';
import type { UserAdminResponse } from '@flux/models';

/**
 * Feature-scoped user details state. Provide at the users route level —
 * never at root.
 */
@Injectable()
export class UserDetailsState implements OnDestroy {
  private readonly identity = inject(IdentityApiService);
  private loads = new Subscription();

  private readonly detailsStore: ResourceStateStore<UserAdminResponse> =
    createResourceState<UserAdminResponse>();
  private readonly permissionsStore: ResourceStateStore<readonly string[]> =
    createResourceState<readonly string[]>();
  private readonly catalogStore: ResourceStateStore<readonly string[]> =
    createResourceState<readonly string[]>();

  /** Current user record (idle → loading → success | error). */
  readonly details: Signal<ResourceState<UserAdminResponse>> = this.detailsStore.state;

  /** Granted permissions (independent slot — see above). */
  readonly permissions: Signal<ResourceState<readonly string[]>> = this.permissionsStore.state;

  /** Full permission catalog (for the grant picker). */
  readonly catalog: Signal<ResourceState<readonly string[]>> = this.catalogStore.state;

  /**
   * Loads the user record plus the granted permissions (independent
   * slots, superseded together). A load issued while another is in
   * flight supersedes it.
   */
  load(userId: string, options: ApiRequestOptions = {}): void {
    this.loads.unsubscribe();
    this.loads = new Subscription();
    this.loads.add(
      loadResourceState(this.detailsStore, this.detailsSource(userId, options), {
        signal: options.signal,
      }),
    );
    this.loads.add(
      loadResourceState(this.permissionsStore, this.permissionsSource(userId, options), {
        signal: options.signal,
      }),
    );
  }

  /** Loads the permission catalog once (grant picker source). */
  loadCatalog(options: ApiRequestOptions = {}): void {
    if (this.catalogStore.isLoading() || this.catalogStore.isSuccess()) {
      return;
    }
    loadResourceState(
      this.catalogStore,
      this.identity
        .permissionCatalog(options)
        .pipe(map((envelope) => envelope.data ?? ([] as string[]))),
      { signal: options.signal },
    );
  }

  /** Reloads the current user (retry and post-mutation refresh). */
  reload(userId: string): void {
    this.load(userId);
  }

  ngOnDestroy(): void {
    this.loads.unsubscribe();
  }

  /** Unwraps a user envelope; a dataless `200` is a contract violation. */
  private detailsSource(userId: string, options: ApiRequestOptions): Observable<UserAdminResponse> {
    return this.identity.getUser(userId, options).pipe(
      map((envelope: ApiResponseWithData<UserAdminResponse>) => {
        const record = envelope.data ?? null;
        if (record === null) {
          throw new ApiError({
            status: 200,
            code: UNKNOWN_ERROR_CODE,
            message: 'The server returned an empty response.',
          });
        }
        return record;
      }),
    );
  }

  /** Unwraps a string-list envelope (missing data reads as empty). */
  private permissionsSource(
    userId: string,
    options: ApiRequestOptions,
  ): Observable<readonly string[]> {
    return this.identity
      .listUserPermissions(userId, options)
      .pipe(map((envelope) => envelope.data ?? []));
  }
}
