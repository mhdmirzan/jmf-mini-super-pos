/**
 * Migration 004: Remove barcode column from products.
 * Scanners and lookups use item_code instead.
 */

function up(db) {
  const pragma = db.prepare('PRAGMA table_info(products)').all();
  if (!pragma.some((c) => c.name === 'barcode')) {
    console.log('[Migration] barcode column already absent — skipping');
    return;
  }

  db.exec('DROP INDEX IF EXISTS idx_products_barcode');
  db.exec('ALTER TABLE products DROP COLUMN barcode');
  console.log('[Migration] Dropped products.barcode column');
}

module.exports = { up };
