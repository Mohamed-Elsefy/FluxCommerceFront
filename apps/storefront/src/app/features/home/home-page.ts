import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Storefront Home page — the primary entry point for product discovery
 * (Sub-Phase 5.2).
 *
 * Composition only: brand heading plus the discovery entry section linking
 * to the Catalog feature (`/catalog`, where category discovery and
 * navigation live). Home owns no catalog data and imports no catalog
 * internals — cross-feature needs go through routes, never through another
 * feature's implementation (`ARCHITECTURE.md` §7). Product discovery UI
 * itself (category list, resource states) is catalog-owned.
 */
@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  templateUrl: './home-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {}
