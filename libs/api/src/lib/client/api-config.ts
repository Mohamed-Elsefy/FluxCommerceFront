/**
 * `libs/api` foundation.
 *
 * Owns generic API infrastructure: configuration shapes and common
 * request/response abstractions. Feature-specific endpoints stay inside
 * their owning feature. HttpClient provisioning lives in `./api-providers`
 * (`provideApi`) and base URL resolution in `./api-base-url` (`API_BASE_URL`).
 */

/** Base configuration required to reach the backend API. */
export interface ApiConfig {
  /** Backend base URL, without a trailing slash. */
  baseUrl: string;
}

/**
 * Joins a configured base URL with a request path, tolerating
 * leading/trailing slashes on either side.
 */
export function buildApiUrl(config: ApiConfig, path: string): string {
  const base = config.baseUrl.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}
