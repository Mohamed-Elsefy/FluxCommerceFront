import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { APP_ENVIRONMENT, AppEnvironment, provideAppEnvironment } from './app-environment';

const environment: AppEnvironment = {
  name: 'development',
  production: false,
  appName: 'test',
  apiBaseUrl: 'https://localhost:7119',
};

describe('provideAppEnvironment', () => {
  it('exposes the environment through APP_ENVIRONMENT', () => {
    TestBed.configureTestingModule({ providers: [provideAppEnvironment(environment)] });

    const resolved = TestBed.inject(APP_ENVIRONMENT);

    expect(resolved).toEqual(environment);
    expect(resolved.apiBaseUrl).toBe('https://localhost:7119');
  });
});
