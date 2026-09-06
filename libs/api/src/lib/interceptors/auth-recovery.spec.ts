/**
 * Recovery interceptor tests for Sub-Phase 2.7 — Centralized 401 Recovery.
 *
 * The seam provider is stubbed per test (its session-backed implementation
 * is covered in `@flux/auth`); HTTP runs through the real pipeline via
 * `HttpTestingController`. Proves the rule set: eligible 401s recover and
 * retry exactly once, excluded endpoints and non-401s propagate untouched,
 * provider faults fall back to the original error, and teardown dispatches
 * no retry.
 */

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Provider, type EnvironmentProviders } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { Subject, of, throwError } from 'rxjs';
import { ApiClient } from '../client/api-client';
import { provideApi } from '../client/api-providers';
import { provideAppEnvironment, type AppEnvironment } from '../client/app-environment';
import {
  AUTH_RECOVERY_PROVIDER,
  isRecoveryEligible,
  type UnauthorizedRecovery,
} from './auth-recovery';
import { ApiError } from '../runtime/error-normalizer';

const environment: AppEnvironment = {
  name: 'development',
  production: false,
  appName: 'test',
  apiBaseUrl: 'https://localhost:7119',
};

const ORDERS_URL = 'https://localhost:7119/orders/missing';

function unauthorizedBody(detail: string): Record<string, unknown> {
  return {
    type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
    title: 'Unauthorized',
    status: 401,
    detail,
    extensions: {},
  };
}

function setup(recovery: UnauthorizedRecovery): {
  client: ApiClient;
  http: HttpTestingController;
  counter: { count: number };
} {
  const counter = { count: 0 };
  const counting: UnauthorizedRecovery = () => {
    counter.count += 1;
    return recovery();
  };
  const providers: (Provider | EnvironmentProviders)[] = [
    provideAppEnvironment(environment),
    provideApi(),
    provideHttpClientTesting(),
    { provide: AUTH_RECOVERY_PROVIDER, useValue: counting },
  ];
  TestBed.configureTestingModule({ providers });
  return {
    client: TestBed.inject(ApiClient),
    http: TestBed.inject(HttpTestingController),
    counter,
  };
}

describe('authRecoveryInterceptor', () => {
  let client: ApiClient;
  let http: HttpTestingController;
  let counter: { count: number };

  function setupWith(recovery: UnauthorizedRecovery): void {
    ({ client, http, counter } = setup(recovery));
  }

  afterEach(() => {
    http.verify();
  });

  it('propagates the original error when recovery declines', () => {
    setupWith(() => of(false));
    let observed: unknown;
    client.get<void>('/orders/missing').subscribe({
      error: (error: unknown) => {
        observed = error;
      },
    });

    http.expectOne(ORDERS_URL).flush(unauthorizedBody('Access token expired.'), {
      status: 401,
      statusText: 'Unauthorized',
    });

    expect(counter.count).toBe(1);
    expect(observed).toBeInstanceOf(ApiError);
    expect((observed as ApiError).status).toBe(401);
    expect((observed as ApiError).message).toBe('Access token expired.');
  });

  it('retries once on recovery success and delivers the retried response', () => {
    setupWith(() => of(true));
    let received: unknown = 'pending';
    client.get<void>('/orders/missing').subscribe((body) => {
      received = body;
    });

    http.expectOne(ORDERS_URL).flush(unauthorizedBody('Access token expired.'), {
      status: 401,
      statusText: 'Unauthorized',
    });
    http.expectOne(ORDERS_URL).flush(null);

    expect(received).toBeNull();
  });

  it('propagates without a third attempt when the retry also 401s', () => {
    setupWith(() => of(true));
    let observed: unknown;
    client.get<void>('/orders/missing').subscribe({
      error: (error: unknown) => {
        observed = error;
      },
    });

    http.expectOne(ORDERS_URL).flush(unauthorizedBody('Access token expired.'), {
      status: 401,
      statusText: 'Unauthorized',
    });
    http.expectOne(ORDERS_URL).flush(unauthorizedBody('Access token revoked.'), {
      status: 401,
      statusText: 'Unauthorized',
    });

    expect(observed).toBeInstanceOf(ApiError);
    expect((observed as ApiError).message).toBe('Access token revoked.');
  });

  it.each(['/auth/login', '/auth/register', '/auth/refresh'])(
    'never recovers %s (loop prevention)',
    (path) => {
      setupWith(() => of(true));
      let observed: unknown;
      client.post<void>(path, {}).subscribe({
        error: (error: unknown) => {
          observed = error;
        },
      });

      http.expectOne(`https://localhost:7119${path}`).flush(unauthorizedBody('Denied.'), {
        status: 401,
        statusText: 'Unauthorized',
      });

      expect(counter.count).toBe(0);
      expect(observed).toBeInstanceOf(ApiError);
      expect((observed as ApiError).message).toBe('Denied.');
    },
  );

  it('leaves non-401 errors untouched without consulting recovery', () => {
    setupWith(() => of(true));
    let observed: unknown;
    client.get<void>('/orders/missing').subscribe({
      error: (error: unknown) => {
        observed = error;
      },
    });

    http.expectOne(ORDERS_URL).flush(
      {
        type: 'https://tools.ietf.org/html/rfc7231#section-6.5.3',
        title: 'Forbidden',
        status: 403,
        detail: 'Forbidden.',
        extensions: {},
      },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(counter.count).toBe(0);
    expect(observed).toBeInstanceOf(ApiError);
    expect((observed as ApiError).status).toBe(403);
  });

  it('falls back to the original error when the provider faults', () => {
    setupWith(() => throwError(() => new Error('recovery blew up')));
    let observed: unknown;
    client.get<void>('/orders/missing').subscribe({
      error: (error: unknown) => {
        observed = error;
      },
    });

    http.expectOne(ORDERS_URL).flush(unauthorizedBody('Access token expired.'), {
      status: 401,
      statusText: 'Unauthorized',
    });

    expect(observed).toBeInstanceOf(ApiError);
    expect((observed as ApiError).message).toBe('Access token expired.');
  });

  it('dispatches no retry after the caller tears down mid-recovery', () => {
    const gate = new Subject<boolean>();
    setupWith(() => gate);
    const errors: unknown[] = [];
    const subscription = client.get<void>('/orders/missing').subscribe({
      error: (error: unknown) => {
        errors.push(error);
      },
    });

    http.expectOne(ORDERS_URL).flush(unauthorizedBody('Access token expired.'), {
      status: 401,
      statusText: 'Unauthorized',
    });
    subscription.unsubscribe();
    gate.next(true);

    http.expectNone(ORDERS_URL);
    expect(errors).toHaveLength(0);
  });
});

describe('isRecoveryEligible', () => {
  it('excludes authentication endpoints by path suffix', () => {
    expect(isRecoveryEligible('https://localhost:7119/auth/login')).toBe(false);
    expect(isRecoveryEligible('https://localhost:7119/auth/register')).toBe(false);
    expect(isRecoveryEligible('https://localhost:7119/auth/refresh')).toBe(false);
    expect(isRecoveryEligible('/auth/refresh')).toBe(false);
  });

  it('keeps recoverable endpoints eligible', () => {
    expect(isRecoveryEligible('https://localhost:7119/auth/me')).toBe(true);
    expect(isRecoveryEligible('https://localhost:7119/orders/missing')).toBe(true);
    expect(isRecoveryEligible('https://localhost:7119/cart')).toBe(true);
  });
});
