import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Observable, Subject, finalize, switchMap } from 'rxjs';
import { ApiClient } from './api-client';
import { provideAppEnvironment, type AppEnvironment } from './app-environment';
import { provideApi } from './api-providers';
import { cancelOnAbort, destroySignal } from './request-lifecycle';

/** Minimal owner double: records destroy callbacks, fires them on demand. */
class TestOwner extends DestroyRef {
  private readonly callbacks: (() => void)[] = [];
  private wasDestroyed = false;

  override get destroyed(): boolean {
    return this.wasDestroyed;
  }

  override onDestroy(callback: () => void): () => void {
    this.callbacks.push(callback);
    return () => undefined;
  }

  destroy(): void {
    this.wasDestroyed = true;
    this.callbacks.splice(0).forEach((callback) => callback());
  }
}

const environment: AppEnvironment = {
  name: 'development',
  production: false,
  appName: 'test',
  apiBaseUrl: 'https://localhost:7119',
};

describe('destroySignal', () => {
  it('aborts the signal when the owner is destroyed, and not before', () => {
    const owner = new TestOwner();
    const signal = destroySignal(owner);

    expect(signal.aborted).toBe(false);
    owner.destroy();
    expect(signal.aborted).toBe(true);
  });
});

describe('cancelOnAbort', () => {
  it('passes values through untouched without a signal', () => {
    const seen: number[] = [];
    let completed = false;
    new Observable<number>((subscriber) => {
      subscriber.next(1);
      subscriber.complete();
    })
      .pipe(cancelOnAbort())
      .subscribe({ next: (value) => seen.push(value), complete: () => (completed = true) });

    expect(seen).toEqual([1]);
    expect(completed).toBe(true);
  });

  it('sends nothing and completes silently for a pre-aborted signal', () => {
    const controller = new AbortController();
    controller.abort();

    let subscribed = false;
    let errored = false;
    let completed = false;
    new Observable<number>(() => {
      subscribed = true;
    })
      .pipe(cancelOnAbort(controller.signal))
      .subscribe({ error: () => (errored = true), complete: () => (completed = true) });

    expect(subscribed).toBe(false);
    expect(errored).toBe(false);
    expect(completed).toBe(true);
  });

  it('completes silently — never errors — when aborted in flight', () => {
    const controller = new AbortController();
    const source = new Subject<number>();
    const seen: number[] = [];
    let errored = false;
    let completed = false;
    source.pipe(cancelOnAbort(controller.signal)).subscribe({
      next: (value) => seen.push(value),
      error: () => (errored = true),
      complete: () => (completed = true),
    });

    source.next(1);
    controller.abort();
    source.next(2);

    expect(seen).toEqual([1]);
    expect(errored).toBe(false);
    expect(completed).toBe(true);
  });

  it('runs teardown on abort so upstream work stops', () => {
    const controller = new AbortController();
    let tornDown = false;
    new Observable<number>(() => () => (tornDown = true))
      .pipe(cancelOnAbort(controller.signal))
      .subscribe();

    expect(tornDown).toBe(false);
    controller.abort();
    expect(tornDown).toBe(true);
  });
});

describe('ApiClient request lifecycle', () => {
  let client: ApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideAppEnvironment(environment), provideApi(), provideHttpClientTesting()],
    });
    client = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('sends no request for a pre-aborted signal', () => {
    const controller = new AbortController();
    controller.abort();

    let errored = false;
    let completed = false;
    client
      .get<void>('/catalog', { signal: controller.signal })
      .subscribe({ error: () => (errored = true), complete: () => (completed = true) });

    http.expectNone('https://localhost:7119/catalog');
    expect(errored).toBe(false);
    expect(completed).toBe(true);
  });

  it('cancels the in-flight request on abort without erroring', () => {
    const controller = new AbortController();
    let errored = false;
    let completed = false;
    client
      .get<void>('/catalog', { signal: controller.signal })
      .subscribe({ error: () => (errored = true), complete: () => (completed = true) });

    const pending = http.expectOne('https://localhost:7119/catalog');
    controller.abort();

    expect(pending.cancelled).toBe(true);
    expect(errored).toBe(false);
    expect(completed).toBe(true);
  });

  it('cancels the owner request on destroy via destroySignal', () => {
    const owner = new TestOwner();
    client.get<void>('/catalog', { signal: destroySignal(owner) }).subscribe();

    const pending = http.expectOne('https://localhost:7119/catalog');
    owner.destroy();

    expect(pending.cancelled).toBe(true);
  });

  it('drops stale responses: only the latest raced request is observed', () => {
    const terms = new Subject<string>();
    const seen: string[] = [];
    let errored = false;
    terms
      .pipe(switchMap((term) => client.get<string>(`/catalog?search=${term}`)))
      .subscribe({ next: (value) => seen.push(value), error: () => (errored = true) });

    terms.next('a');
    const first = http.expectOne('https://localhost:7119/catalog?search=a');
    terms.next('ab');
    const second = http.expectOne('https://localhost:7119/catalog?search=ab');

    expect(first.cancelled).toBe(true);
    second.flush('B-result');

    expect(seen).toEqual(['B-result']);
    expect(errored).toBe(false);
  });

  it('still surfaces real failures with a signal attached', () => {
    const controller = new AbortController();
    let completed = false;
    client
      .get<void>('/catalog', { signal: controller.signal, context: { correlationId: 'flow-1' } })
      .subscribe({
        error: (error: unknown) => {
          expect((error as { status: number }).status).toBe(500);
          expect((error as { correlationId: string | null }).correlationId).toBe('flow-1');
        },
        complete: () => (completed = true),
      });

    http.expectOne('https://localhost:7119/catalog').flush(null, { status: 500, statusText: 'E' });
    expect(completed).toBe(false);
  });

  it('finalizes normally for successful signalled requests', () => {
    const controller = new AbortController();
    let finalized = false;
    client
      .get<void>('/catalog', { signal: controller.signal })
      .pipe(finalize(() => (finalized = true)))
      .subscribe();

    http.expectOne('https://localhost:7119/catalog').flush(null);
    expect(finalized).toBe(true);
    expect(controller.signal.aborted).toBe(false);
  });
});
