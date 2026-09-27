/**
 * Admin Inventory landing page for Sub-Phases 13.8–13.10 — Inventory
 * Foundation plus its slices.
 *
 * Page structure (same convention as the 12.4 dashboard foundation):
 * a localized page header plus one card per inventory section. Cards
 * link to their live routes — never anywhere else, so no dead
 * functionality ships.
 *
 * Explicitly out of scope here: any data-backed card. There is no list
 * endpoint behind this surface (no stock list, no reservation list —
 * see the 13.1 audit), so nothing here performs HTTP: the page
 * composes sync signals plus static metadata only. Async states live
 * on the section pages themselves through the existing shared async
 * UI — no theater states in the meantime.
 *
 * SSR/hydration safe: signals plus static metadata, no browser APIs.
 * RTL safe: grid auto-flow follows the document direction; logical
 * properties only.
 */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CultureService } from '@flux/i18n';
import { Card } from '@flux/ui';
import {
  INVENTORY_TRANSLATION_KEYS,
  translateInventoryKey,
} from '../../i18n/inventory-translations';

interface InventorySection {
  readonly titleKey: string;
  readonly descriptionKey: string;
  /** Live section route (every section is routed — no placeholders remain). */
  readonly route: string;
}

/** Inventory sections in portal order. */
const INVENTORY_SECTIONS: readonly InventorySection[] = [
  {
    titleKey: INVENTORY_TRANSLATION_KEYS.stockTitle,
    descriptionKey: INVENTORY_TRANSLATION_KEYS.stockDescription,
    route: '/inventory/stock',
  },
  {
    titleKey: INVENTORY_TRANSLATION_KEYS.reservationsTitle,
    descriptionKey: INVENTORY_TRANSLATION_KEYS.reservationsDescription,
    route: '/inventory/reservations',
  },
  {
    titleKey: INVENTORY_TRANSLATION_KEYS.adjustmentsTitle,
    descriptionKey: INVENTORY_TRANSLATION_KEYS.adjustmentsDescription,
    route: '/inventory/adjustments',
  },
];

@Component({
  selector: 'app-inventory-home-page',
  imports: [RouterLink, Card],
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
      sections: INVENTORY_SECTIONS.map((section) => ({
        title: translateInventoryKey(culture, section.titleKey),
        description: translateInventoryKey(culture, section.descriptionKey),
        route: section.route,
      })),
    };
  });
}
