import { describe, expect, it } from 'vitest';
import { buildApiUrl, ApiConfig } from './api-config';

const config: ApiConfig = { baseUrl: 'https://localhost:7119' };

describe('buildApiUrl', () => {
  it('joins base URL and path with a single slash', () => {
    expect(buildApiUrl(config, '/products')).toBe('https://localhost:7119/products');
    expect(buildApiUrl(config, 'products')).toBe('https://localhost:7119/products');
  });

  it('tolerates a trailing slash on the base URL', () => {
    expect(buildApiUrl({ baseUrl: 'https://localhost:7119/' }, '/products')).toBe(
      'https://localhost:7119/products',
    );
  });
});
