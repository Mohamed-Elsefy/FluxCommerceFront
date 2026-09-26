import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CultureService } from '@flux/i18n';
import { HOME_TRANSLATION_KEYS, translateHomeKey } from './i18n/home-translations';

@Component({
  selector: 'app-home-page',
  templateUrl: './home-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  private readonly cultures = inject(CultureService);

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      title: translateHomeKey(culture, HOME_TRANSLATION_KEYS.title),
      subtitle: translateHomeKey(culture, HOME_TRANSLATION_KEYS.subtitle),
    };
  });
}
