/**
 * Storefront Not-Found page for Sub-Phase 11.11 — 404 & 500 Error
 * Handling.
 *
 * Lazy route-level fallback (`**` in `app.routes.ts`, rendered on
 * demand in `RenderMode.Server`): unknown URLs serve this page through
 * the Angular pipeline on direct navigation, SSR requests, and in-app
 * navigation alike — never a raw framework page.
 *
 * Copy is localized per the active `CultureService.culture()` through
 * the layout-owned bundle, and the page links back into the Storefront
 * (`/`). Metadata is honest but non-indexable: the title names the
 * missing page and `robots` carries `noindex` (11.4 — invalid resources
 * must never present home/index metadata or invite indexing). No data
 * fetching, no state, no browser APIs: identical render on server and
 * client. RTL safe: logical properties only.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { CultureService } from '@flux/i18n';
import { NOT_FOUND_TRANSLATION_KEYS, translateNotFoundKey } from './not-found-translations';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  templateUrl: './not-found-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPage implements OnInit {
  private readonly cultures = inject(CultureService);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  /** Localized 404 copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      title: translateNotFoundKey(culture, NOT_FOUND_TRANSLATION_KEYS.title),
      message: translateNotFoundKey(culture, NOT_FOUND_TRANSLATION_KEYS.message),
      backToHome: translateNotFoundKey(culture, NOT_FOUND_TRANSLATION_KEYS.backToHome),
    };
  });

  constructor() {
    // Dynamic metadata tracks the culture; `Title`/`Meta` write the
    // document only. Effects never run on the server — `ngOnInit`
    // covers the SSR pass.
    effect(() => {
      this.applyMetadata();
    });
  }

  ngOnInit(): void {
    // Runs on server and client alike: honest, non-indexable metadata
    // applies during SSR into the server `<head>`.
    this.applyMetadata();
  }

  private applyMetadata(): void {
    const copy = this.copy();
    this.title.setTitle(`${copy.title} | FluxCommerce`);
    this.meta.updateTag({ name: 'description', content: copy.message });
    this.meta.updateTag({ name: 'robots', content: 'noindex' });
  }
}
