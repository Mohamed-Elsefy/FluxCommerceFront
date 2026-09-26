import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CultureService } from '@flux/i18n';
import {
  ADMIN_LAYOUT_TRANSLATION_KEYS,
  translateAdminLayoutKey,
} from '../layout-translations/layout-translations';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  templateUrl: './not-found-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPage {
  private readonly cultures = inject(CultureService);

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      title: translateAdminLayoutKey(culture, ADMIN_LAYOUT_TRANSLATION_KEYS.notFoundTitle),
      message: translateAdminLayoutKey(culture, ADMIN_LAYOUT_TRANSLATION_KEYS.notFoundMessage),
      back: translateAdminLayoutKey(culture, ADMIN_LAYOUT_TRANSLATION_KEYS.notFoundBack),
    };
  });
}
