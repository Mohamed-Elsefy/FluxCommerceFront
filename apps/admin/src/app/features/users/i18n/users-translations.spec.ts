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

  it('states the permission-less creation contract in every culture', () => {
    const message = { email: 'boss@flux.local' };
    expect(translateUsersKey('en', USERS_TRANSLATION_KEYS.createSuccessMessage, message)).toContain(
      'with no permissions',
    );
    expect(translateUsersKey('fr', USERS_TRANSLATION_KEYS.createSuccessMessage, message)).toContain(
      'sans autorisations',
    );
    expect(translateUsersKey('de', USERS_TRANSLATION_KEYS.createSuccessMessage, message)).toContain(
      'ohne Berechtigungen',
    );
    expect(translateUsersKey('es', USERS_TRANSLATION_KEYS.createSuccessMessage, message)).toContain(
      'sin permisos',
    );
    expect(translateUsersKey('ar', USERS_TRANSLATION_KEYS.createSuccessMessage, message)).toContain(
      'بلا صلاحيات',
    );
    for (const culture of CULTURES) {
      expect(translateUsersKey(culture, USERS_TRANSLATION_KEYS.createSuccessMessage)).not.toBe(
        USERS_TRANSLATION_KEYS.createSuccessMessage,
      );
      expect(translateUsersKey(culture, USERS_TRANSLATION_KEYS.createSubheading)).not.toBe(
        USERS_TRANSLATION_KEYS.createSubheading,
      );
    }
  });
});
