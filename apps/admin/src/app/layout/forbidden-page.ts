import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CultureService } from '@flux/i18n';
import { ADMIN_LAYOUT_TRANSLATION_KEYS, translateAdminLayoutKey } from './layout-translations';

@Component({
  selector: 'app-forbidden-page',
  imports: [RouterLink],
  templateUrl: './forbidden-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForbiddenPage {
  private readonly cultures = inject(CultureService);

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      title: translateAdminLayoutKey(culture, ADMIN_LAYOUT_TRANSLATION_KEYS.forbiddenTitle),
      message: translateAdminLayoutKey(culture, ADMIN_LAYOUT_TRANSLATION_KEYS.forbiddenMessage),
      back: translateAdminLayoutKey(culture, ADMIN_LAYOUT_TRANSLATION_KEYS.forbiddenBack),
    };
  });
}
