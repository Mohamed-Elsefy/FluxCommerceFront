/**
 * Admin Inventory landing page for Sub-Phase 13.8 — Inventory Feature
 * Foundation.
 *
 * Page structure only (same convention as the 12.4 dashboard
 * foundation): a localized page header plus the three upcoming-section
 * cards (Stock, Reservations, Adjustments) rendered as non-interactive
 * placeholders with an "upcoming" badge — no links, so no dead
 * functionality ships. Section UX arrives with the slices that own it
 * (Sub-Phases 13.9–13.10).
 *
 * Explicitly out of scope (later work, must not appear here): stock
 * lookups, reservation lookups, adjustment forms, and any data-backed
 * card. There is no list endpoint behind this surface (no stock list,
 * no reservation list — see the 13.1 audit), so nothing here performs
 * HTTP: the page composes sync signals plus static metadata only.
 * Loading/empty/error resource states arrive with the first data-backed
 * section (13.9) through the existing shared async UI — no theater
 * states in the meantime.
 *
 * SSR/hydration safe: signals plus static metadata, no browser APIs.
 * RTL safe: grid auto-flow follows the document direction; logical
 * properties only.
 */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CultureService } from '@flux/i18n';
import { Badge, Card } from '@flux/ui';
import {
  INVENTORY_TRANSLATION_KEYS,
  translateInventoryKey,
} from '../../i18n/inventory-translations';

interface UpcomingSection {
  readonly titleKey: string;
  readonly descriptionKey: string;
}

/** Upcoming sections in portal order (placeholders until 13.9–13.10). */
const UPCOMING_SECTIONS: readonly UpcomingSection[] = [
  {
    titleKey: INVENTORY_TRANSLATION_KEYS.stockTitle,
    descriptionKey: INVENTORY_TRANSLATION_KEYS.stockDescription,
  },
  {
    titleKey: INVENTORY_TRANSLATION_KEYS.reservationsTitle,
    descriptionKey: INVENTORY_TRANSLATION_KEYS.reservationsDescription,
  },
  {
    titleKey: INVENTORY_TRANSLATION_KEYS.adjustmentsTitle,
    descriptionKey: INVENTORY_TRANSLATION_KEYS.adjustmentsDescription,
  },
];

@Component({
  selector: 'app-inventory-home-page',
  imports: [Badge, Card],
  templateUrl: './inventory-home-page.html',
  styleUrl: './inventory-home-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryHomePage {
  private readonly cultures = inject(CultureService);

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      title: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.title),
      subtitle: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.subtitle),
      upcoming: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.upcomingBadge),
      sections: UPCOMING_SECTIONS.map((section) => ({
        title: translateInventoryKey(culture, section.titleKey),
        description: translateInventoryKey(culture, section.descriptionKey),
      })),
    };
  });
}
