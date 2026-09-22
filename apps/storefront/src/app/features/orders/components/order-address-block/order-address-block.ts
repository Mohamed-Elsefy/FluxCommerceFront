/**
 * Order address block component for Sub-Phase 10.4 — Order Details.
 *
 * Presentation only: renders HOW one backend address echo reads
 * (recipient plus prejoined display lines under a section heading).
 * The owning page decides WHEN and WHAT — the address arrives
 * preformatted through `toOrderAddressView` (§10.4 models) and the
 * heading arrives as a plain input. No API access, no HTTP, no state
 * writes — presentational components never call backend APIs
 * (`ARCHITECTURE.md` §8).
 *
 * SSR/hydration safe: static markup from inputs only, no browser APIs.
 * RTL safe: logical properties only, no direction branching.
 *
 * Explicitly out of scope (later work, must not appear here): address
 * editing (no backend contract supports it).
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { OrderAddressView } from '../../models/order-details.models';

@Component({
  selector: 'orders-address-block',
  templateUrl: './order-address-block.html',
  styleUrl: './order-address-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderAddressBlock {
  /** Preformatted address view to render (projected by the owning page). */
  @Input({ required: true }) address!: OrderAddressView;

  /** Localized section heading (page-owned, required). */
  @Input({ required: true }) title!: string;
}
