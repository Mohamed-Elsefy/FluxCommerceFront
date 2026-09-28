import { describe, expect, it } from 'vitest';
import {
  ORDERS_TRANSLATION_KEYS,
  ORDERS_TRANSLATION_RESOURCES,
  translateOrdersKey,
} from './orders-translations';

describe('translateOrdersKey', () => {
  it('resolves the landing copy per culture', () => {
    expect(translateOrdersKey('en', ORDERS_TRANSLATION_KEYS.title)).toBe('Orders');
    expect(translateOrdersKey('fr', ORDERS_TRANSLATION_KEYS.title)).toBe('Commandes');
    expect(translateOrdersKey('de', ORDERS_TRANSLATION_KEYS.title)).toBe('Bestellungen');
    expect(translateOrdersKey('es', ORDERS_TRANSLATION_KEYS.title)).toBe('Pedidos');
    expect(translateOrdersKey('ar', ORDERS_TRANSLATION_KEYS.title)).toBe('الطلبات');
  });

  it('resolves the overview fact with the backend-issued count', () => {
    expect(translateOrdersKey('en', ORDERS_TRANSLATION_KEYS.summaryTotal, { count: '42' })).toBe(
      '42 orders',
    );
    expect(translateOrdersKey('fr', ORDERS_TRANSLATION_KEYS.summaryTotal, { count: '7' })).toBe(
      '7 commandes',
    );
    expect(translateOrdersKey('de', ORDERS_TRANSLATION_KEYS.summaryHeading)).toBe('Übersicht');
    expect(translateOrdersKey('es', ORDERS_TRANSLATION_KEYS.emptyTitle)).toBe('Sin pedidos');
    expect(translateOrdersKey('ar', ORDERS_TRANSLATION_KEYS.loading)).toBe('جارٍ تحميل الطلبات…');
  });

  it('resolves the list copy per culture', () => {
    expect(translateOrdersKey('en', ORDERS_TRANSLATION_KEYS.listHeading)).toBe('Orders');
    expect(translateOrdersKey('fr', ORDERS_TRANSLATION_KEYS.listColNumber)).toBe('Commande');
    expect(translateOrdersKey('de', ORDERS_TRANSLATION_KEYS.listColTotal)).toBe('Gesamtbetrag');
    expect(translateOrdersKey('es', ORDERS_TRANSLATION_KEYS.listEmptyTitle)).toBe(
      'No se encontraron pedidos',
    );
    expect(translateOrdersKey('ar', ORDERS_TRANSLATION_KEYS.paginationNext)).toBe('التالية');
  });

  it('falls back deterministically for unknown cultures and keys', () => {
    expect(translateOrdersKey('xx' as never, ORDERS_TRANSLATION_KEYS.title)).toBe('Orders');
    expect(translateOrdersKey('en', 'orders.missing.key')).toBe('orders.missing.key');
  });

  it('resolves every owned key in every culture (no key-path leakage)', () => {
    for (const key of Object.values(ORDERS_TRANSLATION_KEYS)) {
      for (const culture of Object.keys(ORDERS_TRANSLATION_RESOURCES) as Array<
        keyof typeof ORDERS_TRANSLATION_RESOURCES
      >) {
        expect(translateOrdersKey(culture, key), `${culture}:${key}`).not.toBe(key);
      }
    }
  });
});
