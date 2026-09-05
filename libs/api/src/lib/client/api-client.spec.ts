import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiClient } from './api-client';
import { provideAppEnvironment } from './app-environment';
import { provideApi } from './api-providers';
import {
  CORRELATION_ID_CONTEXT,
  CULTURE_CONTEXT,
  IDEMPOTENCY_KEY_CONTEXT,
} from '../runtime/request-context';
import type { AppEnvironment } from './app-environment';

/** Local stand-in payload — specs must not couple libs/api to @flux/models. */
interface TestItem {
  id: string;
  name: string;
}

interface TestEnvelope {
  isSuccess: boolean;
  message?: string | null;
  data?: TestItem | null;
}

const development: AppEnvironment = {
  name: 'development',
  production: false,
  appName: 'test',
  apiBaseUrl: 'https://localhost:7119',
};

function setup(environment: AppEnvironment): {
  client: ApiClient;
  http: HttpTestingController;
} {
  TestBed.configureTestingModule({
    providers: [provideAppEnvironment(environment), provideApi(), provideHttpClientTesting()],
  });
  return { client: TestBed.inject(ApiClient), http: TestBed.inject(HttpTestingController) };
}

describe('ApiClient', () => {
  let client: ApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    ({ client, http } = setup(development));
  });

  afterEach(() => {
    http.verify();
  });

  it('GET joins base URL, interpolates path params, and appends the query', () => {
    let received: TestEnvelope | undefined;
    client
      .get<TestEnvelope>('/orders/{orderId}', {
        pathParams: { orderId: 'order-1' },
        params: { pageNumber: 2 },
      })
      .subscribe((body) => {
        received = body;
      });

    const request = http.expectOne('https://localhost:7119/orders/order-1?pageNumber=2');
    expect(request.request.method).toBe('GET');
    request.flush({ isSuccess: true, data: { id: 'order-1', name: 'Order' } });
    expect(received?.data?.id).toBe('order-1');
  });

  it('encodes path parameter values', () => {
    client.get<TestEnvelope>('/catalog/products/{id}', { pathParams: { id: 'a b/c' } }).subscribe();

    const request = http.expectOne('https://localhost:7119/catalog/products/a%20b%2Fc');
    expect(request.request.method).toBe('GET');
    request.flush({ isSuccess: true });
  });

  it('POST sends the body with custom headers and request context', () => {
    const body = { variantId: 'variant-1', quantity: 2 };
    client
      .post<TestEnvelope>('/cart/items', body, {
        headers: { 'X-Custom': 'yes' },
        context: { correlationId: 'flow-1', culture: 'fr', idempotencyKey: 'key-1' },
      })
      .subscribe();

    const request = http.expectOne('https://localhost:7119/cart/items');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    expect(request.request.headers.get('X-Custom')).toBe('yes');
    expect(request.request.context.get(CORRELATION_ID_CONTEXT)).toBe('flow-1');
    expect(request.request.context.get(CULTURE_CONTEXT)).toBe('fr');
    expect(request.request.context.get(IDEMPOTENCY_KEY_CONTEXT)).toBe('key-1');
    request.flush({ isSuccess: true });
  });

  it('PUT, PATCH, and bodyless DELETE use the right verb and URL', () => {
    client
      .put<void>('/catalog/products/{id}', { name: 'Tee' }, { pathParams: { id: 'p1' } })
      .subscribe();
    expect(http.expectOne('https://localhost:7119/catalog/products/p1').request.method).toBe('PUT');

    client
      .patch<void>('/inventory/{sku}', { quantity: 5 }, { pathParams: { sku: 'SKU-1' } })
      .subscribe();
    const patch = http.expectOne('https://localhost:7119/inventory/SKU-1');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ quantity: 5 });

    client.delete<void>('/cart/items/{variantId}', { pathParams: { variantId: 'v1' } }).subscribe();
    const remove = http.expectOne('https://localhost:7119/cart/items/v1');
    expect(remove.request.method).toBe('DELETE');
    expect(remove.request.body).toBeNull();
  });

  it('supports void responses for 204 No Content calls', () => {
    let completed = false;
    client.post<void>('/catalog/products/p1/activate', {}).subscribe({
      complete: () => {
        completed = true;
      },
    });

    http.expectOne('https://localhost:7119/catalog/products/p1/activate').flush(null);
    expect(completed).toBe(true);
  });
});

describe('ApiClient production base URL', () => {
  let client: ApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    ({ client, http } = setup({ ...development, apiBaseUrl: '/api' }));
  });

  afterEach(() => {
    http.verify();
  });

  it('prefixes same-origin /api paths without feature branching', () => {
    client.get<TestEnvelope>('/catalog', { params: { pageNumber: 1, pageSize: 20 } }).subscribe();

    const request = http.expectOne('/api/catalog?pageNumber=1&pageSize=20');
    expect(request.request.method).toBe('GET');
    request.flush({ isSuccess: true });
  });
});
