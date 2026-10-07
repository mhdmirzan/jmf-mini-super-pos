/**
 * Migration 001: Initial Schema
 * Creates all core business tables as specified in the system design.
 */

function up(db) {
  // ─── USERS ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('SUPER_ADMIN', 'ADMIN', 'CASHIER')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      version INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // ─── PRODUCTS ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
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
      version INTEGER NOT NULL DEFAULT 1
    )
  `);

  // ─── INVOICES ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL UNIQUE,
      cashier_id TEXT NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      total_discount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL CHECK(payment_method IN ('CASH', 'CARD')),
      cash_received REAL,
      cash_change REAL,
      status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK(status IN ('COMPLETED', 'CANCELLED')),
      cancelled_by TEXT,
      cancelled_at TEXT,
      cancellation_reason TEXT,
      device_id TEXT,
      sync_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCING', 'SYNCED', 'FAILED')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (cashier_id) REFERENCES users(id),
      FOREIGN KEY (cancelled_by) REFERENCES users(id)
    )
  `);

  // ─── INVOICE ITEMS ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      item_code TEXT NOT NULL,
      item_name TEXT NOT NULL,
      unit_price REAL NOT NULL,
      quantity REAL NOT NULL,
      unit_discount REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (invoice_id) REFERENCES invoices(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  // ─── SALES RETURNS ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales_returns (
      id TEXT PRIMARY KEY,
      return_number TEXT NOT NULL UNIQUE,
      original_invoice_id TEXT NOT NULL,
      reason TEXT,
      processed_by TEXT NOT NULL,
      device_id TEXT,
      sync_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCING', 'SYNCED', 'FAILED')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (original_invoice_id) REFERENCES invoices(id),
      FOREIGN KEY (processed_by) REFERENCES users(id)
    )
  `);

  // ─── SALES RETURN ITEMS ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales_return_items (
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
    )
  `);

  // ─── STOCK MOVEMENTS ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      movement_type TEXT NOT NULL CHECK(movement_type IN ('PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT')),
      quantity REAL NOT NULL,
      reference_type TEXT,
      reference_id TEXT,
      reason TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // ─── DEVICES ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL UNIQUE,
      device_name TEXT,
      last_sync_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    )
  `);

  // ─── SYNC QUEUE ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'SYNCING', 'SYNCED', 'FAILED')),
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT
    )
  `);

  // ─── SYSTEM SETTINGS ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id TEXT PRIMARY KEY,
      setting_key TEXT NOT NULL UNIQUE,
      setting_value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT,
      FOREIGN KEY (updated_by) REFERENCES users(id)
    )
  `);

  // ─── AUDIT LOGS ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      device_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // ─── INDEXES ───
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_item_code ON products(item_code);
    CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
    CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
    CREATE INDEX IF NOT EXISTS idx_invoices_cashier ON invoices(cashier_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
    CREATE INDEX IF NOT EXISTS idx_invoices_sync_status ON invoices(sync_status);
    CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON invoice_items(product_id);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at);
    CREATE INDEX IF NOT EXISTS idx_sales_returns_invoice ON sales_returns(original_invoice_id);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
  `);

  try {
    const pragma = db.prepare("PRAGMA table_info(products)").all();
    if (!pragma.some(c => c.name === 'wholesale_discount')) {
      db.exec("ALTER TABLE products ADD COLUMN wholesale_discount REAL NOT NULL DEFAULT 0;");
    }
    if (!pragma.some(c => c.name === 'unit')) {
      db.exec("ALTER TABLE products ADD COLUMN unit TEXT NOT NULL DEFAULT 'PCS';");
    }
  } catch (e) {
    // Non-fatal
  }

  // ─── SEED DEFAULT SETTINGS ───
  const { v4: uuidv4 } = require('uuid');

  const settingsExist = db.prepare('SELECT COUNT(*) as count FROM system_settings').get();
  if (settingsExist.count === 0) {
    const insertSetting = db.prepare(
      'INSERT INTO system_settings (id, setting_key, setting_value) VALUES (?, ?, ?)'
    );
    insertSetting.run(uuidv4(), 'MAX_USERS', '5');
    insertSetting.run(uuidv4(), 'SHOP_NAME', 'Your Store');
    insertSetting.run(uuidv4(), 'SHOP_ADDRESS', '');
    insertSetting.run(uuidv4(), 'SHOP_PHONE', '');
    insertSetting.run(uuidv4(), 'RECEIPT_FOOTER', 'Thank you for shopping with us!');
    insertSetting.run(uuidv4(), 'INVOICE_PREFIX', 'INV');
    insertSetting.run(uuidv4(), 'RETURN_PREFIX', 'RET');
    console.log('[Migration] Default settings seeded');
  }

  // ─── SEED DEFAULT USERS (SUPER_ADMIN & ADMIN) ───
  const usersExist = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (usersExist.count === 0) {
    const bcrypt = require('bcryptjs');
    const passwordHash = bcrypt.hashSync('admin123', 10);

    const superAdminId = uuidv4();
    db.prepare(
      `INSERT INTO users (id, username, password_hash, full_name, role, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(superAdminId, 'superadmin', passwordHash, 'Super Administrator', 'SUPER_ADMIN', 1);

    const adminId = uuidv4();
    db.prepare(
      `INSERT INTO users (id, username, password_hash, full_name, role, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(adminId, 'admin', passwordHash, 'Store Administrator', 'ADMIN', 1);

    console.log('[Migration] Default accounts created: superadmin (SUPER_ADMIN) & admin (ADMIN)');
  }
}

module.exports = { up };
