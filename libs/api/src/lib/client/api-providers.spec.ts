import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { API_BASE_URL, normalizeApiBaseUrl, resolveApiBaseUrl } from './api-base-url';
import { provideApi } from './api-providers';
import { APP_ENVIRONMENT, AppEnvironment, provideAppEnvironment } from './app-environment';

const development: AppEnvironment = {
  name: 'development',
  production: false,
  appName: 'test',
  apiBaseUrl: 'https://localhost:7119',
};

const production: AppEnvironment = {
  name: 'production',
  production: true,
  appName: 'test',
  apiBaseUrl: '/api',
};

describe('normalizeApiBaseUrl', () => {
  it('strips trailing slashes and surrounding whitespace', () => {
    expect(normalizeApiBaseUrl('https://localhost:7119/')).toBe('https://localhost:7119');
    expect(normalizeApiBaseUrl('  /api/  ')).toBe('/api');
  });

  it('leaves clean base URLs untouched', () => {
    expect(normalizeApiBaseUrl('https://localhost:7119')).toBe('https://localhost:7119');
    expect(normalizeApiBaseUrl('/api')).toBe('/api');
  });
});

describe('resolveApiBaseUrl', () => {
  it('resolves the development backend origin', () => {
    expect(resolveApiBaseUrl(development)).toBe('https://localhost:7119');
  });

  it('resolves the production same-origin path', () => {
    expect(resolveApiBaseUrl(production)).toBe('/api');
  });
});

describe('provideApi', () => {
  it('provides HttpClient and resolves API_BASE_URL from the app environment', () => {
    TestBed.configureTestingModule({
      providers: [provideAppEnvironment(development), provideApi()],
    });

    expect(TestBed.inject(HttpClient)).toBeDefined();
    expect(TestBed.inject(API_BASE_URL)).toBe('https://localhost:7119');
    expect(TestBed.inject(APP_ENVIRONMENT)).toEqual(development);
  });

  it('normalizes a trailing-slash base URL through DI', () => {
    TestBed.configureTestingModule({
      providers: [
        provideAppEnvironment({ ...development, apiBaseUrl: 'https://localhost:7119/' }),
        provideApi(),
      ],
    });

    expect(TestBed.inject(API_BASE_URL)).toBe('https://localhost:7119');
  });
});
