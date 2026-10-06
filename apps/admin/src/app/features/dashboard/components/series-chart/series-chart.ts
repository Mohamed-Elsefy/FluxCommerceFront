/**
 * Daily-series chart for the admin dashboard analytics evolution.
 *
 * Feature-owned presentational component: renders HOW trailing-day
 * points read — SVG order bars (progressive enhancement,
 * `aria-hidden`) over an always-rendered day list (the accessible,
 * RTL-safe content: invariant UTC date verbatim, culture-formatted
 * order counts and per-currency revenue). Dumb by design — the owning
 * page decides WHEN and WHAT (points arrive as a plain input,
 * backend values verbatim). No API access, no HTTP, no state writes.
 *
 * Backend-authoritative rules: point dates echo verbatim (never
 * localized, never parsed into `Date`); amounts echo verbatim except
 * through culture formatting for display. Bar heights are display
 * scaling only (normalized against the window max, zero floor).
 *
 * SSR/hydration safe: static markup from inputs + culture only, no
 * browser APIs. RTL safe: logical properties only, no direction
 * branching (bar order follows document flow neutrally — the list
 * below carries meaning in reading order).
 */

import { ChangeDetectionStrategy, Component, inject, Input } from '@angular/core';
import { CultureService, formatCurrency, formatNumber } from '@flux/i18n';
import type { DailySeriesPointResponse } from '@flux/models';

export interface SeriesChartBar {
  readonly x: number;
  readonly width: number;
  readonly height: number;
  readonly date: string;
}

@Component({
  selector: 'app-series-chart',
  templateUrl: './series-chart.html',
  styleUrl: './series-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeriesChart {
  /** Trailing-day points, oldest-first (backend order, verbatim). */
  @Input() points: readonly DailySeriesPointResponse[] = [];

  private readonly cultures = inject(CultureService);

  /** Bar geometry normalized against the window max (display scaling only). */
  protected bars(): SeriesChartBar[] {
    const points = this.points;
    if (points.length === 0) {
      return [];
    }
    const max = Math.max(1, ...points.map((point) => point.orders));
    const slot = 100 / points.length;
    return points.map((point, index) => ({
      x: index * slot,
      width: slot * 0.7,
      height: (point.orders / max) * 100,
      date: point.date,
    }));
  }

  /** Culture-formatted order count for one point (display only). */
  protected ordersText(orders: number): string {
    return formatNumber(orders, this.cultures.culture());
  }

  /** Culture-formatted per-currency revenue for one point (display only). */
  protected revenueText(currency: string, amount: number): string {
    return formatCurrency(amount, currency, this.cultures.culture());
  }
}
