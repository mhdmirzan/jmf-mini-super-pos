-- Bill item deletions (POS notifications for admin)
CREATE TABLE IF NOT EXISTS bill_item_deletions (
  id TEXT PRIMARY KEY,
  bill_reference TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT NOT NULL,
  item_code TEXT,
  quantity REAL NOT NULL,
  unit TEXT,
  unit_price REAL NOT NULL DEFAULT 0,
  line_amount REAL NOT NULL DEFAULT 0,
  cashier_id TEXT,
  cashier_name TEXT,
  device_id TEXT,
  message TEXT NOT NULL,
  seen_by_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bill_item_deletions_created
  ON bill_item_deletions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bill_item_deletions_bill
  ON bill_item_deletions(bill_reference);
CREATE INDEX IF NOT EXISTS idx_bill_item_deletions_admin_seen
  ON bill_item_deletions(seen_by_admin, created_at DESC);
