/**
 * Header / query-input contracts for Sub-Phase 1.1.
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §0.4,
 * `docs/frontend-contract/DTO_REFERENCE.md` §7,
 * `docs/frontend-contract/AUTH_FLOW.md` §2, and
 * `docs/frontend-contract/LOCALIZATION_CONTRACT.md` §§1-2.
 *
 * - Auth: JWT Bearer `Authorization: Bearer <accessToken>` (15m access,
 *   5m clock skew). Refresh presents the opaque token, never a JWT.
 * - Localization (every op, optional): providers `?culture=` > cookie >
 *   `Accept-Language`. Supported: `en|fr|de|es|ar` (default `en`); `ar` is
 *   RTL. Responses carry `Content-Language` with the resolved culture
 *   (may differ from the request on fallback — mixed-language payloads are
 *   normal and `detail` must be rendered as-is).
 * - Tracing (optional in, always echoed out): `X-Correlation-ID` reused or
 *   generated (`Guid:N`); responses echo `X-Correlation-ID` + `X-Request-ID`.
 * - Checkout idempotency: `Idempotency-Key` required on
 *   `POST /orders/checkout` only (1..128 chars, trimmed, header — not body).
 * - Health endpoints carry no auth and no `ApiResponse` envelope.
 */

/** Backend-supported culture identifiers (frontend must stay consistent). */
export type SupportedCulture = 'en' | 'fr' | 'de' | 'es' | 'ar';

/** Default culture when none is negotiated. */
export const DEFAULT_CULTURE: SupportedCulture = 'en';

/** All cultures the backend localizes (`SupportedCultures` + `SupportedUICultures`). */
export const SUPPORTED_CULTURES: readonly SupportedCulture[] = ['en', 'fr', 'de', 'es', 'ar'];

/** JWT bearer header for every `[Authorize]` endpoint. */
export interface AuthHeader {
  Authorization: `Bearer ${string}`;
}

/**
 * Culture inputs: header (every op, optional) or `?culture=` query override
 * (wins over the header — best for link sharing/debugging).
 */
export interface LocaleInput {
  'Accept-Language'?: SupportedCulture;
  culture?: string;
}

/** Per-flow tracing header (optional inbound, always echoed in responses). */
export interface CorrelationHeaders {
  'X-Correlation-ID'?: string;
}

/** Required on `POST /orders/checkout` only — 1..128 chars, trimmed. */
export interface IdempotencyKeyHeader {
  'Idempotency-Key': string;
}

/** `Content-Type: application/json` for POST/PUT/PATCH with a body. */
export interface JsonContentHeader {
  'Content-Type': 'application/json';
}

/** Single health-check component (`duration` is ms, property is `duration`). */
export interface HealthComponent {
  name: string;
  status: string;
  description: string | null;
  duration: number;
}

/**
 * `GET /health/live` + `GET /health` payload — no auth, no envelope.
 * `200` healthy, `503` otherwise.
 */
export interface HealthResponse {
  status: string;
  duration: number;
  components: HealthComponent[];
}
