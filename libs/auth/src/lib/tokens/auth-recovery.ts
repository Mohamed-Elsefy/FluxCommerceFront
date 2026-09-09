/**
 * Recovery provider wiring for Sub-Phase 2.7 — Centralized 401 Recovery.
 *
 * Binds the Phase 1 `AUTH_RECOVERY_PROVIDER` seam (`libs/api`) to the
 * single-flight refresh lifecycle (`./token-refresh.service`, Sub-Phase
 * 2.6): an eligible 401 triggers at most one shared rotation, `true`
 * retries the original request once through the interceptor pipeline
 * (picking up the rotated token centrally), and `false` propagates the
 * original error after session cleanup.
 *
 * Registration: applications call `provideAuthRecovery()` once next to
 * `provideApi()` and `provideAccessToken()`. Tests override
 * `AUTH_RECOVERY_PROVIDER` (or drive `TokenRefreshService`) the same way
 * Phase 1 specs do.
 */

import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { AUTH_RECOVERY_PROVIDER } from '@flux/api';
import { TokenRefreshService } from './token-refresh.service';

/**
 * Overrides the Phase 1 declining default (`() => of(false)`) with the
 * session-backed single-flight implementation. Call once per application
 * bootstrap.
 */
export function provideAuthRecovery(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: AUTH_RECOVERY_PROVIDER,
      useFactory: (refresher: TokenRefreshService) => () => refresher.refreshSession(),
      deps: [TokenRefreshService],
    },
  ]);
}
