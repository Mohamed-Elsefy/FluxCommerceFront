/**
 * Resource state architecture for Sub-Phase 1.9 — Resource State Architecture.
 *
 * Scope: `docs/phases/PHASE_1_CORE_INFRASTRUCTURE.md` §1.9
 * (`ARCHITECTURE.md` §13 — resource state pattern).
 *
 * Lifecycle (features decide WHEN; this module defines HOW it looks):
 *
 * ```text
 * Idle → Loading → Success | Empty | Error → (Loading → … on refetch/reset)
 * ```
 *
 * - `ResourceState<T>`: immutable snapshot — `status`, payload `data`
 *   (retained across loading/error so UIs can render stale-while-revalidate),
 *   normalized `error` (`ApiError | null`, Sub-Phase 1.5), and derived flags
 *   (`isLoading`/`isSuccess`/`isEmpty`/`isError`). Empty vs success is a
 *   FEATURE decision (only the feature knows what "empty" means) expressed
 *   via `setEmpty` / the `isEmpty` predicate of `loadResourceState`.
 * - `createResourceState<T>()`: local Signals primitive. The writable signal
 *   never leaves the owning scope (component or feature data-access service);
 *   only the readonly `state` + computed selectors escape. NO global store,
 *   NO `providedIn: 'root'` service, NO NgRx — genuinely global concerns
 *   (auth, culture, theme, app config) are the only shared state.
 *
 * Composition with earlier sub-phases: `loadResourceState` drives a store
 * from any `Observable` (typically `ApiClient`), classifies failures through
 * the 1.5 normalizer, and honors 1.7 `AbortSignal` cancellation (aborts
 * complete silently and leave state untouched — cancellation is not failure;
 * the owner decides, e.g. `reset()`).
 *
 * Explicitly NOT here (later work): presentation components for
 * loading/skeleton/empty/error/retry (1.10); feature stores for complex
 * workflows (only when justified, per feature).
 */

import { HttpErrorResponse } from '@angular/common/http';
import { computed, signal } from '@angular/core';
import type { Signal } from '@angular/core';
import type { Observable, Subscription } from 'rxjs';
import {
  ApiError,
  isApiError,
  normalizeHttpError,
  normalizeUnknownError,
} from './error-normalizer';
import { cancelOnAbort } from './request-lifecycle';

/** Async resource lifecycle stage. */
export type ResourceStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

/**
 * Immutable resource snapshot. `data` is retained (not cleared) on loading
 * and error transitions; `error` is always a normalized `ApiError`.
 */
export interface ResourceState<T> {
  readonly status: ResourceStatus;
  readonly data: T | null;
  readonly error: ApiError | null;
  readonly isLoading: boolean;
  readonly isSuccess: boolean;
  readonly isEmpty: boolean;
  readonly isError: boolean;
}

function createState<T>(
  status: ResourceStatus,
  data: T | null,
  error: ApiError | null,
): ResourceState<T> {
  return {
    status,
    data,
    error,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
    isEmpty: status === 'empty',
    isError: status === 'error',
  };
}

/** Untouched resource (initial state of every store). */
export function idleResource<T>(): ResourceState<T> {
  return createState<T>('idle', null, null);
}

/** In-flight resource, optionally retaining previously loaded data. */
export function loadingResource<T>(previousData: T | null = null): ResourceState<T> {
  return createState<T>('loading', previousData, null);
}

/** Successfully loaded resource. */
export function successResource<T>(data: T): ResourceState<T> {
  return createState<T>('success', data, null);
}

/** Loaded-but-empty resource (feature-defined emptiness), keeping any payload. */
export function emptyResource<T>(data: T | null = null): ResourceState<T> {
  return createState<T>('empty', data, null);
}

/** Coerces any rejection into a normalized `ApiError` for the error state. */
function toApiError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }
  if (error instanceof HttpErrorResponse) {
    return normalizeHttpError(error);
  }
  return normalizeUnknownError(error);
}

/** Failed resource (`error` always normalized), optionally retaining data. */
export function errorResource<T>(error: unknown, previousData: T | null = null): ResourceState<T> {
  return createState<T>('error', previousData, toApiError(error));
}

/**
 * Local resource store. Created and owned by a component or feature
 * data-access service — never shared globally, never injected.
 */
export interface ResourceStateStore<T> {
  readonly state: Signal<ResourceState<T>>;
  readonly status: Signal<ResourceStatus>;
  readonly data: Signal<T | null>;
  readonly error: Signal<ApiError | null>;
  readonly isLoading: Signal<boolean>;
  readonly isSuccess: Signal<boolean>;
  readonly isEmpty: Signal<boolean>;
  readonly isError: Signal<boolean>;
  setLoading(previousData?: T | null): void;
  setSuccess(data: T): void;
  setEmpty(data?: T | null): void;
  setError(error: unknown): void;
  reset(): void;
}

/**
 * Creates a locally owned resource store starting at `idle`. All transitions
 * are explicit method calls — no hidden effects, no cross-feature coupling.
 */
export function createResourceState<T>(
  initial: ResourceState<T> = idleResource<T>(),
): ResourceStateStore<T> {
  const current = signal(initial);
  const select = <V>(project: (state: ResourceState<T>) => V): Signal<V> =>
    computed(() => project(current()));
  return {
    state: current.asReadonly(),
    status: select((state) => state.status),
    data: select((state) => state.data),
    error: select((state) => state.error),
    isLoading: select((state) => state.isLoading),
    isSuccess: select((state) => state.isSuccess),
    isEmpty: select((state) => state.isEmpty),
    isError: select((state) => state.isError),
    setLoading: (previousData: T | null = null) => current.set(loadingResource(previousData)),
    setSuccess: (data: T) => current.set(successResource(data)),
    setEmpty: (data: T | null = null) => current.set(emptyResource(data)),
    setError: (error: unknown) => current.set(errorResource(error, current().data)),
    reset: () => current.set(idleResource<T>()),
  };
}

/**
 * Default emptiness rule: `null`/`undefined` or zero-length arrays are empty.
 * Override per feature when emptiness means something else (e.g. a filter
 * object with no matches still carries facets).
 */
export function isEmptyData(data: unknown): boolean {
  return data === null || data === undefined || (Array.isArray(data) && data.length === 0);
}

/**
 * Drives a store from an `Observable` through `Loading → Success | Empty |
 * Error`, retaining current data during reloads. Failures are normalized to
 * `ApiError`; an aborted `signal` completes silently and leaves state
 * untouched. Returns the subscription for owner-managed teardown.
 */
export function loadResourceState<T>(
  store: ResourceStateStore<T>,
  source: Observable<T>,
  options: { signal?: AbortSignal; isEmpty?: (data: T) => boolean } = {},
): Subscription {
  const isEmpty = options.isEmpty ?? isEmptyData;
  store.setLoading(store.data());
  return source.pipe(cancelOnAbort(options.signal)).subscribe({
    next: (data) => {
      if (isEmpty(data)) {
        store.setEmpty(data);
      } else {
        store.setSuccess(data);
      }
    },
    error: (error: unknown) => store.setError(error),
  });
}
