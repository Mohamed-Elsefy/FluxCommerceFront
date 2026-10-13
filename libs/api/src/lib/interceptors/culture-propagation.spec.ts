/**
 * Culture-to-HTTP integration tests for Sub-Phase 4.8 — SSR, Hydration &
 * End-to-End Validation.
 *
 * Proves the composed 4.5 chain through the real HTTP stack (no mocks
 * below `HttpTestingController`):
 *
 * ```text
 * CultureService.setCulture (libs/i18n)
 *      ↓ provideCulturePropagation (ACTIVE_CULTURE_PROVIDER seam)
 * requestConfigInterceptor (real pipeline slot)
 *      ↓
 * Accept-Language on the outbound request
 * ```
 *
 * Runtime switches affect subsequent requests without restarts, and
 * explicit per-request culture still wins over the service state.
 */

import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CultureService, provideCulturePropagation } from '@flux/i18n';
import { toHttpContext } from '../runtime/request-context';
import { requestConfigInterceptor } from './request-config-interceptor';

function setup(): {
  service: CultureService;
  client: HttpClient;
  http: HttpTestingController;
} {
  TestBed.configureTestingModule({
    providers: [
      provideCulturePropagation(),
      provideHttpClient(withInterceptors([requestConfigInterceptor])),
      provideHttpClientTesting(),
    ],
  });
  return {
    service: TestBed.inject(CultureService),
    client: TestBed.inject(HttpClient),
    http: TestBed.inject(HttpTestingController),
  };
}

describe('culture-to-HTTP integration', () => {
  let service: CultureService;
  let client: HttpClient;
  let http: HttpTestingController;

  beforeEach(() => {
    window.localStorage.clear();
    ({ service, client, http } = setup());
    service.initialize();
  });

  afterEach(() => {
    http.verify();
  });

  it('sends the active service culture on every request', () => {
    expect(service.culture()).toBe('en');

    client.get('/catalog').subscribe();
    const request = http.expectOne('/catalog');
    expect(request.request.headers.get('Accept-Language')).toBe('en');
    request.flush(null);
  });

  it('applies runtime language switches to subsequent requests without restarts', () => {
    service.setCulture('ar');

    client.get('/catalog').subscribe();
    const arabic = http.expectOne('/catalog');
    expect(arabic.request.headers.get('Accept-Language')).toBe('ar');
    arabic.flush(null);

    service.setCulture('fr');

    client.get('/catalog').subscribe();
    const french = http.expectOne('/catalog');
    expect(french.request.headers.get('Accept-Language')).toBe('fr');
    french.flush(null);
  });

  it('lets explicit per-request culture win over the service culture', () => {
    service.setCulture('ar');

    client.get('/catalog', { context: toHttpContext({ culture: 'fr' }) }).subscribe();
    const overridden = http.expectOne('/catalog');
    expect(overridden.request.headers.get('Accept-Language')).toBe('fr');
    overridden.flush(null);
  });
});
