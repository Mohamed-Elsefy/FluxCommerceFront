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

  it('resolves the status labels per culture', () => {
    expect(translateOrdersKey('en', ORDERS_TRANSLATION_KEYS.statusPending)).toBe('Pending');
    expect(translateOrdersKey('fr', ORDERS_TRANSLATION_KEYS.statusConfirmed)).toBe('Confirmée');
    expect(translateOrdersKey('de', ORDERS_TRANSLATION_KEYS.statusCancelled)).toBe('Storniert');
    expect(translateOrdersKey('es', ORDERS_TRANSLATION_KEYS.statusPending)).toBe('Pendiente');
    expect(translateOrdersKey('ar', ORDERS_TRANSLATION_KEYS.statusConfirmed)).toBe('مؤكّد');
    expect(
      translateOrdersKey('en', ORDERS_TRANSLATION_KEYS.statusUnknown, { value: 'Shipped' }),
    ).toBe('Unknown (Shipped)');
  });

  it('resolves the details copy per culture', () => {
    expect(translateOrdersKey('en', ORDERS_TRANSLATION_KEYS.detailsBack)).toBe('Back to orders');
    expect(translateOrdersKey('fr', ORDERS_TRANSLATION_KEYS.detailsCustomerTitle)).toBe(
      'Informations client',
    );
    expect(translateOrdersKey('de', ORDERS_TRANSLATION_KEYS.detailsItemsTitle)).toBe(
      'Bestellpositionen',
    );
    expect(translateOrdersKey('es', ORDERS_TRANSLATION_KEYS.detailsColLineTotal)).toBe(
      'Total de línea',
    );
    expect(translateOrdersKey('ar', ORDERS_TRANSLATION_KEYS.detailsFactTotal)).toBe('الإجمالي');
  });

  it('resolves the payment copy per culture', () => {
    expect(translateOrdersKey('en', ORDERS_TRANSLATION_KEYS.paymentTitle)).toBe('Payment');
    expect(translateOrdersKey('fr', ORDERS_TRANSLATION_KEYS.paymentEmptyTitle)).toBe(
      'Aucune information de paiement',
    );
    expect(translateOrdersKey('de', ORDERS_TRANSLATION_KEYS.paymentFactAmount)).toBe('Betrag');
    expect(translateOrdersKey('es', ORDERS_TRANSLATION_KEYS.paymentErrorTitle)).toBe(
      'No se pudo cargar el pago',
    );
    expect(translateOrdersKey('ar', ORDERS_TRANSLATION_KEYS.paymentFactReference)).toBe('المرجع');
  });

  it('resolves the payment status labels per culture', () => {
    expect(translateOrdersKey('en', ORDERS_TRANSLATION_KEYS.paymentStatusFailed)).toBe('Failed');
    expect(translateOrdersKey('fr', ORDERS_TRANSLATION_KEYS.paymentStatusSucceeded)).toBe('Réussi');
    expect(translateOrdersKey('de', ORDERS_TRANSLATION_KEYS.paymentStatusProcessing)).toBe(
      'In Bearbeitung',
    );
    expect(translateOrdersKey('es', ORDERS_TRANSLATION_KEYS.paymentStatusRefunded)).toBe(
      'Reembolsado',
    );
    expect(translateOrdersKey('ar', ORDERS_TRANSLATION_KEYS.paymentStatusCancelled)).toBe('ملغى');
    expect(
      translateOrdersKey('en', ORDERS_TRANSLATION_KEYS.paymentStatusUnknown, { value: 'X' }),
    ).toBe('Unknown (X)');
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
