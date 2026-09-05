/**
 * Lifecycle-safe request cancellation for Sub-Phase 1.7 — Request Cancellation & Lifecycle.
 *
 * Scope: `docs/phases/PHASE_1_CORE_INFRASTRUCTURE.md` §1.7.
 *
 * Two lifecycle hazards, two mechanisms (compose them; either alone is safe):
 *
 * ```text
 * 1. Owner destroyed while a request is in flight:
 *    Component destroyed → DestroyRef → destroySignal() → AbortSignal
 *      → ApiClient unsubscribes → fetch aborted → subscriber completes
 *        silently (NO error, NO callback, NO state write → no leak)
 *
 * 2. Stale request overwriting newer state (search/filter race):
 *    Search A → Search B → switchMap unsubscribes A → A aborted server-side
 *      → only B's response is observed (stale data can never win)
 * ```
 *
 * - `destroySignal(destroyRef)` bridges Angular destruction into an
 *   `AbortSignal` (works in components, directives, and injectable services;
 *   SSR-safe — `AbortController` exists in Node and browsers).
 * - `cancelOnAbort(signal?)` is the operator `ApiClient` applies to every
 *   verb. Pre-aborted signals send nothing (`EMPTY`); in-flight aborts
 *   complete the subscriber silently — a cancellation is therefore NEVER
 *   observed as an `ApiError` (contrast: real failures still normalize via
 *   Sub-Phase 1.5, incl. the `RequestCancelled` classification for aborts
 *   raised below this layer).
 * - Race replacement itself stays `switchMap` in feature code (framework
 *   primitive, not re-invented here); this module guarantees the unsubscribed
 *   inner request is actually aborted and silently dropped.
 *
 * Explicitly NOT here: query/pagination abstractions (1.8, `./query`) and
 * resource-state signals/stores (1.9, `./resource-state`) — sibling modules
 * this layer composes with instead of duplicating.
 */

import type { DestroyRef } from '@angular/core';
import { Observable } from 'rxjs';
import type { MonoTypeOperatorFunction } from 'rxjs';

/**
 * Returns an `AbortSignal` that aborts when `destroyRef` is destroyed.
 * Pass it as `ApiRequestOptions.signal` (optionally combined with
 * `switchMap` for race replacement). Call with an injected `DestroyRef`:
 *
 * ```ts
 * private readonly destroyRef = inject(DestroyRef);
 * this.api.get<CartResponse>('/cart', { signal: destroySignal(this.destroyRef) });
 * ```
 */
export function destroySignal(destroyRef: DestroyRef): AbortSignal {
  const controller = new AbortController();
  destroyRef.onDestroy(() => controller.abort());
  return controller.signal;
}

/**
 * Completes the source silently when `signal` aborts (pre-aborted signals
 * subscribe to nothing, so no request is sent). Unsubscribing tears down the
 * upstream subscription, which aborts the underlying fetch. Absent signals
 * pass the source through untouched.
 */
export function cancelOnAbort<T>(signal?: AbortSignal): MonoTypeOperatorFunction<T> {
  if (!signal) {
    return (source: Observable<T>) => source;
  }
  return (source: Observable<T>) =>
    new Observable<T>((subscriber) => {
      if (signal.aborted) {
        subscriber.complete();
        return undefined;
      }
      const onAbort = (): void => {
        if (!subscriber.closed) {
          subscriber.complete();
        }
      };
      signal.addEventListener('abort', onAbort, { once: true });
      const subscription = source.subscribe(subscriber);
      return (): void => {
        signal.removeEventListener('abort', onAbort);
        subscription.unsubscribe();
      };
    });
}
