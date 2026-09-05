import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { Subject, of, throwError } from 'rxjs';
import { ApiError, NETWORK_ERROR_CODE } from './error-normalizer';
import {
  createResourceState,
  emptyResource,
  errorResource,
  idleResource,
  isEmptyData,
  loadResourceState,
  loadingResource,
  successResource,
} from './resource-state';

describe('resource factories', () => {
  it('builds exclusive idle/loading/success/empty states with coherent flags', () => {
    const idle = idleResource<string[]>();
    expect(idle).toMatchObject({
      status: 'idle',
      data: null,
      error: null,
      isLoading: false,
      isSuccess: false,
      isEmpty: false,
      isError: false,
    });

    const loading = loadingResource(['stale']);
    expect(loading).toMatchObject({ status: 'loading', data: ['stale'], error: null });
    expect(loading.isLoading).toBe(true);

    const success = successResource(['a']);
    expect(success).toMatchObject({ status: 'success', data: ['a'], isSuccess: true });

    const empty = emptyResource<string[]>();
    expect(empty).toMatchObject({ status: 'empty', data: null, isEmpty: true });
  });

  it('normalizes error input and retains previous data', () => {
    const apiError = new ApiError({ status: 404, message: 'Missing.' });
    expect(errorResource(apiError, ['stale']).error).toBe(apiError);

    const httpFailure = errorResource<string[]>(
      new HttpErrorResponse({ status: 503, error: { status: 503, detail: 'Down.' } }),
    );
    expect(httpFailure.error).toBeInstanceOf(ApiError);
    expect(httpFailure.error?.status).toBe(503);
    expect(httpFailure.error?.message).toBe('Down.');
    expect(httpFailure.isError).toBe(true);

    const unexpected = errorResource(new Error('Blew up.'));
    expect(unexpected.error?.code).toBeDefined();
    expect(unexpected.error?.message).toBe('Blew up.');
  });
});

describe('isEmptyData', () => {
  it('treats nullish and zero-length arrays as empty only', () => {
    expect(isEmptyData(null)).toBe(true);
    expect(isEmptyData(undefined)).toBe(true);
    expect(isEmptyData([])).toBe(true);
    expect(isEmptyData(['a'])).toBe(false);
    expect(isEmptyData({ items: [] })).toBe(false);
    expect(isEmptyData('')).toBe(false);
  });
});

describe('createResourceState', () => {
  it('starts idle and transitions explicitly with live selectors', () => {
    const store = createResourceState<string[]>();

    expect(store.status()).toBe('idle');
    expect(store.data()).toBeNull();

    store.setLoading();
    expect(store.status()).toBe('loading');
    expect(store.isLoading()).toBe(true);

    store.setSuccess(['a']);
    expect(store.state()).toMatchObject({ status: 'success', data: ['a'], error: null });
    expect(store.isSuccess()).toBe(true);
    expect(store.isLoading()).toBe(false);
  });

  it('retains data across loading and error, and resets to idle', () => {
    const store = createResourceState<string[]>();

    store.setSuccess(['a']);
    store.setLoading(store.data());
    expect(store.data()).toEqual(['a']);

    store.setError(new ApiError({ status: 0, code: NETWORK_ERROR_CODE, message: 'Down.' }));
    expect(store.isError()).toBe(true);
    expect(store.data()).toEqual(['a']);
    expect(store.error()?.code).toBe(NETWORK_ERROR_CODE);

    store.setEmpty([]);
    expect(store.isEmpty()).toBe(true);

    store.reset();
    expect(store.state()).toMatchObject({ status: 'idle', data: null, error: null });
  });

  it('keeps each store instance independent (no global state)', () => {
    const first = createResourceState<string>();
    const second = createResourceState<string>();

    first.setSuccess('one');
    expect(first.data()).toBe('one');
    expect(second.status()).toBe('idle');
    expect(second.data()).toBeNull();
  });
});

describe('loadResourceState', () => {
  it('drives Idle → Loading → Success across an emission', () => {
    const store = createResourceState<string[]>();
    expect(store.status()).toBe('idle');

    const source = new Subject<string[]>();
    const subscription = loadResourceState(store, source);
    expect(store.status()).toBe('loading');
    expect(store.isLoading()).toBe(true);

    source.next(['a', 'b']);
    expect(store.status()).toBe('success');
    expect(store.data()).toEqual(['a', 'b']);
    expect(store.error()).toBeNull();
    subscription.unsubscribe();
  });

  it('routes empty payloads to Empty via the default rule or an override', () => {
    const store = createResourceState<string[]>();
    loadResourceState(store, of([]));
    expect(store.status()).toBe('empty');

    const custom = createResourceState<string>();
    loadResourceState(custom, of('whatever'), { isEmpty: (data) => data === 'whatever' });
    expect(custom.status()).toBe('empty');
    expect(custom.data()).toBe('whatever');
  });

  it('routes rejections to normalized Error state', () => {
    const store = createResourceState<string>();
    loadResourceState(
      store,
      throwError(() => new Error('Blew up.')),
    );

    expect(store.isError()).toBe(true);
    expect(store.error()).toBeInstanceOf(ApiError);
    expect(store.error()?.message).toBe('Blew up.');
  });

  it('leaves state untouched on cancellation (cancellation is not failure)', () => {
    const controller = new AbortController();
    const store = createResourceState<string>();
    const source = new Subject<string>();
    loadResourceState(store, source, { signal: controller.signal });

    expect(store.status()).toBe('loading');
    controller.abort();

    expect(store.status()).toBe('loading');
    expect(store.isError()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('retains current data while reloading', () => {
    const store = createResourceState<string[]>();
    store.setSuccess(['stale']);
    const source = new Subject<string[]>();
    loadResourceState(store, source);

    expect(store.status()).toBe('loading');
    expect(store.data()).toEqual(['stale']);

    source.next(['fresh']);
    expect(store.data()).toEqual(['fresh']);
  });
});
