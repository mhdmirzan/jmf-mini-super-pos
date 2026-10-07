/**
 * Migration 005: Remove categories and sub-categories completely.
 * Rebuilds products (and sales_return_items if needed) when DROP COLUMN
 * fails due to legacy foreign-key definitions.
 */

function rebuildProductsWithoutCategories(db) {
  db.exec(`
    CREATE TABLE products__no_cat (
      id TEXT PRIMARY KEY,
      item_code TEXT NOT NULL UNIQUE,
      item_name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      minimum_quantity REAL NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0,
      retail_price REAL NOT NULL DEFAULT 0,
      retail_discount REAL NOT NULL DEFAULT 0,
      wholesale_price REAL NOT NULL DEFAULT 0,
      wholesale_discount REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      version INTEGER NOT NULL DEFAULT 1,
      unit TEXT NOT NULL DEFAULT 'PCS'
    );

    INSERT INTO products__no_cat (
      id, item_code, item_name, quantity, minimum_quantity, cost, retail_price,
      retail_discount, wholesale_price, wholesale_discount, is_active,
      created_at, updated_at, version, unit
    )
    SELECT
      id, item_code, item_name, quantity, minimum_quantity, cost, retail_price,
      retail_discount, wholesale_price,
      COALESCE(wholesale_discount, 0),
      is_active, created_at, updated_at, version,
      COALESCE(unit, 'PCS')
    FROM products;

    DROP TABLE products;
    ALTER TABLE products__no_cat RENAME TO products;
    CREATE INDEX IF NOT EXISTS idx_products_item_code ON products(item_code);
    CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
  `);
  console.log('[Migration] Rebuilt products table without category columns');
}

function rebuildSalesReturnItemsWithoutCategory(db) {
  const pragma = db.prepare('PRAGMA table_info(sales_return_items)').all();
  if (!pragma.some((c) => c.name === 'category_id')) return;

  db.exec(`
    CREATE TABLE sales_return_items__no_cat (
      id TEXT PRIMARY KEY,
      return_id TEXT NOT NULL,
      invoice_item_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      item_code TEXT NOT NULL,
      item_name TEXT NOT NULL,
      sales_price REAL NOT NULL,
      quantity REAL NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (return_id) REFERENCES sales_returns(id),
      FOREIGN KEY (invoice_item_id) REFERENCES invoice_items(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    INSERT INTO sales_return_items__no_cat (
      id, return_id, invoice_item_id, product_id, item_code, item_name,
      sales_price, quantity, reason, created_at
    )
    SELECT
      id, return_id, invoice_item_id, product_id, item_code, item_name,
      sales_price, quantity, reason, created_at
    FROM sales_return_items;

    DROP TABLE sales_return_items;
    ALTER TABLE sales_return_items__no_cat RENAME TO sales_return_items;
  `);
  console.log('[Migration] Rebuilt sales_return_items without category_id');
}

function up(db) {
  db.exec('DROP INDEX IF EXISTS idx_sub_categories_category');
  db.exec('DROP INDEX IF EXISTS idx_products_category');
  db.exec('DROP TABLE IF EXISTS sub_categories');
  db.exec('DROP TABLE IF EXISTS categories');

  const pragma = db.prepare('PRAGMA table_info(products)').all();
  const hasCat = pragma.some((c) => c.name === 'category_id' || c.name === 'sub_category_id');
  if (hasCat) {
    try {
      if (pragma.some((c) => c.name === 'category_id')) {
        db.exec('ALTER TABLE products DROP COLUMN category_id');
      }
      if (pragma.some((c) => c.name === 'sub_category_id')) {
        db.exec('ALTER TABLE products DROP COLUMN sub_category_id');
      }
    } catch (e) {
      console.warn('[Migration] DROP COLUMN failed, rebuilding products:', e.message);
      rebuildProductsWithoutCategories(db);
    }
  }

  try {
    rebuildSalesReturnItemsWithoutCategory(db);
  } catch (e) {
    console.warn('[Migration] sales_return_items rebuild:', e.message);
  }

  console.log('[Migration] Removed categories and sub_categories');
}

module.exports = { up };
