import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CultureService } from '@flux/i18n';
import type { DailySeriesPointResponse } from '@flux/models';
import { SeriesChart } from './series-chart';

function points(): DailySeriesPointResponse[] {
  return [
    { date: '2026-09-06', orders: 0, revenue: [] },
    {
      date: '2026-10-05',
      orders: 2,
      revenue: [{ currency: 'USD', amount: 140 }],
    },
  ];
}

function setup(input: DailySeriesPointResponse[]): {
  fixture: ComponentFixture<SeriesChart>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({});
  window.localStorage.clear();
  const fixture = TestBed.createComponent(SeriesChart);
  fixture.componentRef.setInput('points', input);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('SeriesChart', () => {
  it('renders bars scaled to the window max with dates verbatim', () => {
    const { element } = setup(points());

    const bars = [...element.querySelectorAll('svg.series-chart-bars rect')];
    expect(bars).toHaveLength(2);
    expect(bars[0]?.getAttribute('height')).toBe('0');
    expect(bars[1]?.getAttribute('height')).toBe('100');
    expect(element.textContent).toContain('2026-10-05');
  });

  it('renders the accessible day list with formatted amounts', () => {
    const { element } = setup(points());

    const rows = [...element.querySelectorAll('.series-chart-points > li')];
    expect(rows).toHaveLength(2);
    expect(element.textContent).toContain('$140.00');
  });

  it('renders nothing without points', () => {
    const { element } = setup([]);

    expect(element.querySelectorAll('svg.series-chart-bars rect')).toHaveLength(0);
    expect(element.querySelectorAll('.series-chart-points > li')).toHaveLength(0);
  });

  it('keeps invariant dates across cultures', () => {
    const { fixture, element } = setup(points());
    TestBed.inject(CultureService).setCulture('ar');
    try {
      fixture.detectChanges();

      expect(element.textContent).toContain('2026-10-05');
      expect(element.textContent).not.toContain('series.chart.date');
    } finally {
      TestBed.inject(CultureService).setCulture('en');
    }
  });
});
