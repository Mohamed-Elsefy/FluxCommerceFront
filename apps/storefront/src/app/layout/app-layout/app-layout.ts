/**
 * Storefront application shell for Sub-Phase 3.6.
 *
 * Composition only — Header, Main (router outlet), Footer:
 *
 * ```text
 * Skip link
 *    ↓
 * StorefrontHeader (brand, nav, mobile menu, auth entry points)
 *    ↓
 * Main → Router Outlet (lazy pages; shell stays eager)
 *    ↓
 * StorefrontFooter (brand, explore group, legal line)
 * ```
 *
 * No routing logic, no state, no business UI: pages own their experience
 * and arrive lazily (see `app.routes.ts`). The skip link targets the main
 * landmark for keyboard users. SSR/hydration safe: static composition of
 * SSR-safe children (closed mobile menu, neutral auth placeholder).
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { StorefrontFooter } from '../footer/footer';
import { StorefrontHeader } from '../header/header';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, StorefrontHeader, StorefrontFooter],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLayout {}
