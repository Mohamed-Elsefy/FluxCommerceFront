import { describe, expect, it } from 'vitest';
import { lookupTranslationKey } from '@flux/i18n';
import {
  USERS_TRANSLATION_KEYS,
  USERS_TRANSLATION_RESOURCES,
  translateUsersKey,
} from './users-translations';

const CULTURES = ['en', 'fr', 'de', 'es', 'ar'] as const;
const KEYS = Object.values(USERS_TRANSLATION_KEYS);

describe('users translation parity', () => {
  it('exposes a bundle for every supported culture', () => {
    expect(Object.keys(USERS_TRANSLATION_RESOURCES).sort()).toEqual([...CULTURES].sort());
  });

  it('resolves every owned key to a non-empty string in every culture', () => {
    for (const culture of CULTURES) {
      for (const key of KEYS) {
        const hit = lookupTranslationKey(USERS_TRANSLATION_RESOURCES[culture], key);
        expect(hit, `${culture}:${key}`).toBeTypeOf('string');
        expect(hit?.length, `${culture}:${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('interpolates permission and email slots', () => {
    expect(
      translateUsersKey('en', USERS_TRANSLATION_KEYS.detailsNotifyGrantMessage, {
        permission: 'orders.read',
        email: 'boss@flux.local',
      }),
    ).toBe('Granted orders.read to boss@flux.local.');
    expect(
      translateUsersKey('ar', USERS_TRANSLATION_KEYS.detailsDialogMessage, {
        permission: 'orders.read',
        email: 'boss@flux.local',
      }),
    ).toBe('إلغاء orders.read من boss@flux.local؟');
  });

  it('localizes copy (non-English cultures differ from English)', () => {
    for (const culture of ['fr', 'de', 'es', 'ar'] as const) {
      expect(translateUsersKey(culture, USERS_TRANSLATION_KEYS.homeHeading)).not.toBe(
        translateUsersKey('en', USERS_TRANSLATION_KEYS.homeHeading),
      );
    }
  });
});
