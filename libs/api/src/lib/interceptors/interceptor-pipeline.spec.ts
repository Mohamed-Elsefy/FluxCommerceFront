import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiClient } from '../client/api-client';
import { API_INTERCEPTORS, provideApi } from '../client/api-providers';
import { provideAppEnvironment, type AppEnvironment } from '../client/app-environment';
import { ACCESS_TOKEN_PROVIDER } from './auth-token';
import { ACTIVE_CULTURE_PROVIDER } from './culture-token';
import { ApiError, NETWORK_ERROR_CODE } from '../runtime/error-normalizer';
import type { SupportedCulture } from '../contracts/api-headers';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
import { authInterceptor } from './auth-interceptor';
import { authRecoveryInterceptor } from './auth-recovery';
import { correlationInterceptor } from './correlation-interceptor';
import { httpErrorHookInterceptor } from './http-error-hook-interceptor';
import { requestConfigInterceptor } from './request-config-interceptor';

const environment: AppEnvironment = {
  name: 'development',
  production: false,
  appName: 'test',
  apiBaseUrl: 'https://localhost:7119',
};

function setup(extraProviders: Provider[] = []): {
  client: ApiClient;
  http: HttpTestingController;
} {
  TestBed.configureTestingModule({
    providers: [
      provideAppEnvironment(environment),
      provideApi(),
      provideHttpClientTesting(),
      ...extraProviders,
    ],
  });
  return { client: TestBed.inject(ApiClient), http: TestBed.inject(HttpTestingController) };
}

describe('API_INTERCEPTORS', () => {
  it('declares the canonical execution order', () => {
    expect(API_INTERCEPTORS).toEqual([
      correlationInterceptor,
      requestConfigInterceptor,
      authRecoveryInterceptor,
      authInterceptor,
      httpErrorHookInterceptor,
    ]);
  });
});

describe('interceptor pipeline (anonymous)', () => {
  let client: ApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    ({ client, http } = setup());
  });

  afterEach(() => {
    http.verify();
  });

  it('propagates the flow id from context and generates one when unset', () => {
    client.get<void>('/catalog', { context: { correlationId: 'flow-1' } }).subscribe();
    const correlated = http.expectOne('https://localhost:7119/catalog');
    expect(correlated.request.headers.get('X-Correlation-ID')).toBe('flow-1');
    correlated.flush(null);

    client.get<void>('/catalog').subscribe();
    const generated = http.expectOne('https://localhost:7119/catalog');
    const generatedId = generated.request.headers.get('X-Correlation-ID');
    expect(generatedId).toMatch(UUID_PATTERN);
    generated.flush(null);

    client.get<void>('/catalog').subscribe();
    const regenerated = http.expectOne('https://localhost:7119/catalog');
    expect(regenerated.request.headers.get('X-Correlation-ID')).toMatch(UUID_PATTERN);
    expect(regenerated.request.headers.get('X-Correlation-ID')).not.toBe(generatedId);
    regenerated.flush(null);
  });

  it('attaches Accept-Language and Idempotency-Key only when supplied', () => {
    client
      .post<void>('/orders/checkout', {}, { context: { culture: 'ar', idempotencyKey: 'k1' } })
      .subscribe();
    const configured = http.expectOne('https://localhost:7119/orders/checkout');
    expect(configured.request.headers.get('Accept-Language')).toBe('ar');
    expect(configured.request.headers.get('Idempotency-Key')).toBe('k1');
    configured.flush(null);

    client.post<void>('/orders/checkout', {}).subscribe();
    const bare = http.expectOne('https://localhost:7119/orders/checkout');
    expect(bare.request.headers.has('Accept-Language')).toBe(false);
    expect(bare.request.headers.has('Idempotency-Key')).toBe(false);
    bare.flush(null);
  });

  it('sends no Authorization header while no token provider is installed', () => {
    client.get<void>('/auth/me').subscribe();
    const request = http.expectOne('https://localhost:7119/auth/me');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(null);
  });

  it('normalizes ProblemDetails into ApiError (code best-effort, detail verbatim)', () => {
    let received: unknown;
    client.get<void>('/orders/missing').subscribe({
      error: (error: unknown) => {
        received = error;
      },
    });

    http.expectOne('https://localhost:7119/orders/missing').flush(
      {
        type: 'https://tools.ietf.org/html/rfc7231#section-6.5.4',
        title: 'Not Found',
        status: 404,
        detail: 'Order not found.',
        traceId: 'trace-1',
        extensions: {},
      },
      { status: 404, statusText: 'Not Found' },
    );

    expect(received).toBeInstanceOf(ApiError);
    const normalized = received as ApiError;
    expect(normalized.status).toBe(404);
    expect(normalized.code).toBeUndefined();
    expect(normalized.message).toBe('Order not found.');
    expect(normalized.traceId).toBe('trace-1');
    expect(normalized.correlationId).toMatch(UUID_PATTERN);
  });

  it('attaches the sent correlation id to normalized errors', () => {
    let received: unknown;
    client.get<void>('/orders/missing', { context: { correlationId: 'flow-7' } }).subscribe({
      error: (error: unknown) => {
        received = error;
      },
    });

    http
      .expectOne('https://localhost:7119/orders/missing')
      .flush(
        { status: 409, detail: 'Conflict.' },
        { status: 409, statusText: 'Conflict', headers: { 'X-Correlation-ID': 'echo-7' } },
      );

    expect(received).toBeInstanceOf(ApiError);
    expect((received as ApiError).correlationId).toBe('flow-7');
  });

  it('traces generated ids end to end onto normalized errors', () => {
    let received: unknown;
    client.get<void>('/orders/missing').subscribe({
      error: (error: unknown) => {
        received = error;
      },
    });

    const pending = http.expectOne('https://localhost:7119/orders/missing');
    const sentId = pending.request.headers.get('X-Correlation-ID');
    expect(sentId).toMatch(UUID_PATTERN);
    pending.flush(
      { status: 409, detail: 'Conflict.' },
      { status: 409, statusText: 'Conflict', headers: { 'X-Correlation-ID': 'echo-9' } },
    );

    expect(received).toBeInstanceOf(ApiError);
    expect((received as ApiError).correlationId).toBe(sentId);
  });

  it('normalizes network failures to the NetworkError code', () => {
    let received: unknown;
    client.get<void>('/catalog').subscribe({
      error: (error: unknown) => {
        received = error;
      },
    });

    http.expectOne('https://localhost:7119/catalog').error(new ProgressEvent('error'));

    expect(received).toBeInstanceOf(ApiError);
    expect((received as ApiError).status).toBe(0);
    expect((received as ApiError).code).toBe(NETWORK_ERROR_CODE);
  });
});

describe('interceptor pipeline (token provider installed)', () => {
  let client: ApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    ({ client, http } = setup([{ provide: ACCESS_TOKEN_PROVIDER, useValue: () => 'token-abc' }]));
  });

  afterEach(() => {
    http.verify();
  });

  it('attaches the Bearer token from the provider', () => {
    client.get<void>('/auth/me').subscribe();
    const request = http.expectOne('https://localhost:7119/auth/me');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token-abc');
    request.flush(null);
  });

  it('never clobbers an explicitly set Authorization header', () => {
    client.get<void>('/auth/me', { headers: { Authorization: 'Bearer explicit' } }).subscribe();
    const request = http.expectOne('https://localhost:7119/auth/me');
    expect(request.request.headers.get('Authorization')).toBe('Bearer explicit');
    request.flush(null);
  });

  it('withholds the Bearer token from third-party absolute URLs (11.12)', () => {
    TestBed.inject(HttpClient).get('https://cdn.example.com/lib.js').subscribe();
    const request = http.expectOne('https://cdn.example.com/lib.js');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(null);
  });
});

describe('interceptor pipeline (culture provider installed)', () => {
  let client: ApiClient;
  let http: HttpTestingController;
  let ambient: SupportedCulture | null;

  beforeEach(() => {
    ambient = 'en';
    ({ client, http } = setup([{ provide: ACTIVE_CULTURE_PROVIDER, useValue: () => ambient }]));
  });

  afterEach(() => {
    http.verify();
  });

  it('injects the ambient culture into every request without per-request context', () => {
    ambient = 'ar';

    client.get<void>('/catalog').subscribe();
    const request = http.expectOne('https://localhost:7119/catalog');
    expect(request.request.headers.get('Accept-Language')).toBe('ar');
    request.flush(null);
  });

  it('prefers explicit per-request culture over the ambient culture', () => {
    ambient = 'ar';

    client.get<void>('/catalog', { context: { culture: 'fr' } }).subscribe();
    const request = http.expectOne('https://localhost:7119/catalog');
    expect(request.request.headers.get('Accept-Language')).toBe('fr');
    request.flush(null);
  });

  it('never clobbers an explicitly set Accept-Language header', () => {
    ambient = 'ar';

    client.get<void>('/catalog', { headers: { 'Accept-Language': 'de' } }).subscribe();
    const request = http.expectOne('https://localhost:7119/catalog');
    expect(request.request.headers.get('Accept-Language')).toBe('de');
    request.flush(null);
  });

  it('applies runtime culture switches to subsequent requests without restarts', () => {
    ambient = 'en';

    client.get<void>('/catalog').subscribe();
    const first = http.expectOne('https://localhost:7119/catalog');
    expect(first.request.headers.get('Accept-Language')).toBe('en');
    first.flush(null);

    ambient = 'ar';

    client.get<void>('/catalog').subscribe();
    const second = http.expectOne('https://localhost:7119/catalog');
    expect(second.request.headers.get('Accept-Language')).toBe('ar');
    second.flush(null);
  });

  it('sends no Accept-Language header when the provider resolves to null', () => {
    ambient = null;

    client.get<void>('/catalog').subscribe();
    const request = http.expectOne('https://localhost:7119/catalog');
    expect(request.request.headers.has('Accept-Language')).toBe(false);
    request.flush(null);
  });
});
