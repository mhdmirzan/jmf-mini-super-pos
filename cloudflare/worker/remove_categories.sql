-- Rebuild products without category columns (D1 / SQLite)
CREATE TABLE IF NOT EXISTS products__no_cat (
  id TEXT PRIMARY KEY,
  item_code TEXT NOT NULL UNIQUE,
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'PCS',
  quantity REAL NOT NULL DEFAULT 0,
  minimum_quantity REAL NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  retail_price REAL NOT NULL DEFAULT 0,
  retail_discount REAL NOT NULL DEFAULT 0,
  wholesale_price REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1
);

INSERT INTO products__no_cat (
  id, item_code, item_name, unit, quantity, minimum_quantity, cost, retail_price,
  retail_discount, wholesale_price, is_active, created_at, updated_at, version
)
SELECT
  id, item_code, item_name, COALESCE(unit, 'PCS'), quantity, minimum_quantity, cost, retail_price,
  retail_discount, wholesale_price, is_active, created_at, updated_at, version
FROM products;

DROP TABLE products;
ALTER TABLE products__no_cat RENAME TO products;
CREATE INDEX IF NOT EXISTS idx_d1_products_item_code ON products(item_code);

-- Rebuild sales_return_items without category_id
CREATE TABLE IF NOT EXISTS sales_return_items__no_cat (
  id TEXT PRIMARY KEY,
  return_id TEXT NOT NULL,
  invoice_item_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  item_code TEXT NOT NULL,
  item_name TEXT NOT NULL,
  sales_price REAL NOT NULL DEFAULT 0,
  quantity REAL NOT NULL DEFAULT 1,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
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

DROP TABLE IF EXISTS sub_categories;
DROP TABLE IF EXISTS categories;
