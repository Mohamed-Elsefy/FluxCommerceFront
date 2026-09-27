import { describe, expect, it } from 'vitest';
import {
  INVENTORY_TRANSLATION_KEYS,
  INVENTORY_TRANSLATION_RESOURCES,
  translateInventoryKey,
} from './inventory-translations';

describe('translateInventoryKey', () => {
  it('resolves the landing copy per culture', () => {
    expect(translateInventoryKey('en', INVENTORY_TRANSLATION_KEYS.title)).toBe('Inventory');
    expect(translateInventoryKey('fr', INVENTORY_TRANSLATION_KEYS.title)).toBe('Inventaire');
    expect(translateInventoryKey('de', INVENTORY_TRANSLATION_KEYS.stockTitle)).toBe('Bestand');
    expect(translateInventoryKey('es', INVENTORY_TRANSLATION_KEYS.reservationsTitle)).toBe(
      'Reservas',
    );
    expect(translateInventoryKey('ar', INVENTORY_TRANSLATION_KEYS.adjustmentsTitle)).toBe(
      'التعديلات',
    );
  });

  it('falls back deterministically for unknown cultures and keys', () => {
    expect(translateInventoryKey('xx' as never, INVENTORY_TRANSLATION_KEYS.title)).toBe(
      'Inventory',
    );
    expect(translateInventoryKey('en', 'inventory.missing.key')).toBe('inventory.missing.key');
  });

  it('resolves every owned key in every culture (no key-path leakage)', () => {
    for (const key of Object.values(INVENTORY_TRANSLATION_KEYS)) {
      for (const culture of Object.keys(INVENTORY_TRANSLATION_RESOURCES) as Array<
        keyof typeof INVENTORY_TRANSLATION_RESOURCES
      >) {
        expect(translateInventoryKey(culture, key), `${culture}:${key}`).not.toBe(key);
      }
    }
  });
});
