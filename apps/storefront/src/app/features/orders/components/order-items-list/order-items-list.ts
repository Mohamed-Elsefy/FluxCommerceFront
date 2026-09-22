/**
 * Order items list component for Sub-Phase 10.4 — Order Details.
 *
 * Presentation only: renders HOW the backend line items read (a data
 * table of product, SKU, quantity, backend unit price, and backend line
 * total). The owning page decides WHEN and WHAT — rows arrive
 * preformatted through `toOrderDetailsItemView` (§10.4 models) and
 * headers arrive as one labels object. No API access, no HTTP, no state
 * writes, no price math — presentational components never call backend
 * APIs (`ARCHITECTURE.md` §8).
 *
 * Backend-authoritative guardrails (this sub-phase's core constraint):
 * - Line totals render the backend `lineTotal` text per row. There is
 *   deliberately no `unitPrice × quantity` anywhere in this component —
 *   the suite pins an inconsistent backend lineTotal rendering verbatim.
 * - No thumbnails: line items carry no image/product fields
 *   (`productName`, `sku`, quantities, and prices only).
 *
 * A data table carries the column relationships for assistive
 * technology (`th scope="col"`); an empty item list renders the
 * page-owned note instead of an empty table.
 *
 * SSR/hydration safe: static markup from inputs only, no browser APIs.
 * RTL safe: logical properties only, no direction branching.
 *
 * Explicitly out of scope (later work, must not appear here): quantity
 * editing or re-order actions (no backend contract supports them here).
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { OrderDetailsItemView } from '../../models/order-details.models';

/** Page-localized column headers for the items table (no interpolation left). */
export interface OrderItemsLabels {
  readonly product: string;
  readonly sku: string;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly lineTotal: string;
}

@Component({
  selector: 'orders-items-list',
  templateUrl: './order-items-list.html',
  styleUrl: './order-items-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderItemsList {
  /** Preformatted item rows to render (projected by the owning page). */
  @Input({ required: true }) items: readonly OrderDetailsItemView[] = [];

  /** Page-localized column headers (required). */
  @Input({ required: true }) labels!: OrderItemsLabels;

  /** Page-localized note for orders without items (required). */
  @Input({ required: true }) emptyMessage!: string;
}
