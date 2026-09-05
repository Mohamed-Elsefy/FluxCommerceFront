import { HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiClient } from './api-client';
import { API_INTERCEPTORS, provideApi } from './api-providers';
import { provideAppEnvironment, type AppEnvironment } from './app-environment';
import { ACCESS_TOKEN_PROVIDER } from './auth-token';
import { authInterceptor } from './auth-interceptor';
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

  it('propagates X-Correlation-ID from context and sends none when unset', () => {
    client.get<void>('/catalog', { context: { correlationId: 'flow-1' } }).subscribe();
    const correlated = http.expectOne('https://localhost:7119/catalog');
    expect(correlated.request.headers.get('X-Correlation-ID')).toBe('flow-1');
    correlated.flush(null);

    client.get<void>('/catalog').subscribe();
    const plain = http.expectOne('https://localhost:7119/catalog');
    expect(plain.request.headers.has('X-Correlation-ID')).toBe(false);
    plain.flush(null);
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

  it('passes transport errors through unmapped (1.5 owns normalization)', () => {
    let received: unknown;
    client.get<void>('/orders/missing').subscribe({
      error: (error: unknown) => {
        received = error;
      },
    });

    const body = { status: 404, detail: 'Not Found' };
    http
      .expectOne('https://localhost:7119/orders/missing')
      .flush(body, { status: 404, statusText: 'Not Found' });

    expect(received).toBeInstanceOf(HttpErrorResponse);
    expect((received as HttpErrorResponse).status).toBe(404);
    expect((received as HttpErrorResponse).error).toEqual(body);
  });

  it('passes network failures through untouched', () => {
    let received: unknown;
    client.get<void>('/catalog').subscribe({
      error: (error: unknown) => {
        received = error;
      },
    });

    http.expectOne('https://localhost:7119/catalog').error(new ProgressEvent('error'));

    expect(received).toBeInstanceOf(HttpErrorResponse);
    expect((received as HttpErrorResponse).status).toBe(0);
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
});
