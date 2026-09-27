import { describe, expect, it } from 'vitest';
import { CATALOG_TRANSLATION_KEYS, translateCatalogKey } from './catalog-translations';

describe('translateCatalogKey', () => {
  it('resolves the landing copy per culture', () => {
    expect(translateCatalogKey('en', CATALOG_TRANSLATION_KEYS.title)).toBe('Catalog');
    expect(translateCatalogKey('fr', CATALOG_TRANSLATION_KEYS.title)).toBe('Catalogue');
    expect(translateCatalogKey('de', CATALOG_TRANSLATION_KEYS.productsTitle)).toBe('Produkte');
    expect(translateCatalogKey('es', CATALOG_TRANSLATION_KEYS.categoriesTitle)).toBe('Categorías');
    expect(translateCatalogKey('ar', CATALOG_TRANSLATION_KEYS.title)).toBe('الكتالوج');
  });

  it('interpolates backend-issued totals into the section facts', () => {
    expect(translateCatalogKey('en', CATALOG_TRANSLATION_KEYS.productsTotal, { count: '42' })).toBe(
      'Total: 42',
    );
    expect(
      translateCatalogKey('fr', CATALOG_TRANSLATION_KEYS.categoriesTotal, { count: '7' }),
    ).toBe('Total : 7');
  });

  it('resolves loading, error, and empty states per culture', () => {
    expect(translateCatalogKey('en', CATALOG_TRANSLATION_KEYS.loading)).toBe(
      'Loading catalog overview…',
    );
    expect(translateCatalogKey('de', CATALOG_TRANSLATION_KEYS.errorTitle)).toBe(
      'Katalogübersicht konnte nicht geladen werden',
    );
    expect(translateCatalogKey('es', CATALOG_TRANSLATION_KEYS.emptyTitle)).toBe(
      'Aún no hay datos de catálogo',
    );
    expect(translateCatalogKey('ar', CATALOG_TRANSLATION_KEYS.emptyMessage)).toBe(
      'ستظهر المنتجات والفئات هنا عند توفرها.',
    );
  });

  it('resolves the product slice copy per culture', () => {
    expect(translateCatalogKey('en', CATALOG_TRANSLATION_KEYS.listHeading)).toBe('Products');
    expect(translateCatalogKey('de', CATALOG_TRANSLATION_KEYS.listNew)).toBe('Neues Produkt');
    expect(translateCatalogKey('es', CATALOG_TRANSLATION_KEYS.formSave)).toBe(
      'Guardar el producto',
    );
    expect(translateCatalogKey('ar', CATALOG_TRANSLATION_KEYS.detailsVariantsTitle)).toBe(
      'المتغيرات',
    );
    expect(
      translateCatalogKey('en', CATALOG_TRANSLATION_KEYS.createSuccessMessage, { name: 'Tee' }),
    ).toBe('“Tee” was created.');
    expect(
      translateCatalogKey('fr', CATALOG_TRANSLATION_KEYS.lifecycleConfirmMessage, {
        action: 'supprimer',
        name: 'Tee',
      }),
    ).toBe('Voulez-vous supprimer « Tee » ?');
    expect(translateCatalogKey('en', CATALOG_TRANSLATION_KEYS.statusUnknown, { value: 99 })).toBe(
      'Unknown (99)',
    );
  });

  it('resolves the variant slice copy per culture', () => {
    expect(translateCatalogKey('en', CATALOG_TRANSLATION_KEYS.variantsHeading)).toBe('Variants');
    expect(translateCatalogKey('de', CATALOG_TRANSLATION_KEYS.variantsNew)).toBe('Neue Variante');
    expect(translateCatalogKey('es', CATALOG_TRANSLATION_KEYS.variantFormSave)).toBe(
      'Guardar la variante',
    );
    expect(translateCatalogKey('ar', CATALOG_TRANSLATION_KEYS.variantDetailsDelete)).toBe(
      'حذف المتغير',
    );
    expect(
      translateCatalogKey('en', CATALOG_TRANSLATION_KEYS.variantCreateSuccessMessage, {
        sku: 'TEE-BLK-M',
      }),
    ).toBe('“TEE-BLK-M” was created.');
    expect(
      translateCatalogKey('fr', CATALOG_TRANSLATION_KEYS.variantDetailsConfirmMessage, {
        sku: 'TEE-BLK-M',
      }),
    ).toBe('Voulez-vous supprimer « TEE-BLK-M » ?');
    expect(
      translateCatalogKey('en', CATALOG_TRANSLATION_KEYS.variantStatusUnknown, { value: 99 }),
    ).toBe('Unknown (99)');
  });

  it('falls back deterministically for unknown cultures and keys', () => {
    expect(translateCatalogKey('xx' as never, CATALOG_TRANSLATION_KEYS.title)).toBe('Catalog');
    expect(translateCatalogKey('en', 'catalog.missing.key')).toBe('catalog.missing.key');
  });
});
