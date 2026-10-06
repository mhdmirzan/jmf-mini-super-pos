/**
 * Wipe transactional/history data and permanently remove archived products.
 * Keeps: active products, categories, sub_categories, users, system_settings, devices.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const candidates = [
  path.join(process.env.APPDATA || '', 'jmf-mini-super-pos', 'pos-database.sqlite'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'jmf-mini-super-pos', 'pos-database.sqlite'),
];

const dbPath = candidates.find((p) => p && fs.existsSync(p));
if (!dbPath) {
  console.log('[Reset] Local SQLite database not found.');
  process.exit(0);
}

const Database = require('better-sqlite3');
const db = new Database(dbPath);

const before = {
  invoices: db.prepare('SELECT COUNT(*) AS c FROM invoices').get().c,
  invoiceItems: db.prepare('SELECT COUNT(*) AS c FROM invoice_items').get().c,
  returns: db.prepare('SELECT COUNT(*) AS c FROM sales_returns').get().c,
  movements: db.prepare('SELECT COUNT(*) AS c FROM stock_movements').get().c,
  syncQueue: db.prepare('SELECT COUNT(*) AS c FROM sync_queue').get().c,
  auditLogs: db.prepare('SELECT COUNT(*) AS c FROM audit_logs').get().c,
  approvals: db.prepare('SELECT COUNT(*) AS c FROM approval_requests').get().c,
  archived: db.prepare('SELECT COUNT(*) AS c FROM products WHERE is_active = 0').get().c,
  activeProducts: db.prepare('SELECT COUNT(*) AS c FROM products WHERE is_active = 1').get().c,
};

db.exec(`
  DELETE FROM sales_return_items;
  DELETE FROM sales_returns;
  DELETE FROM invoice_items;
  DELETE FROM invoices;
  DELETE FROM stock_movements;
  DELETE FROM sync_queue;
  DELETE FROM audit_logs;
  DELETE FROM approval_requests;
  DELETE FROM products WHERE is_active = 0;
`);

const after = {
  invoices: db.prepare('SELECT COUNT(*) AS c FROM invoices').get().c,
  movements: db.prepare('SELECT COUNT(*) AS c FROM stock_movements').get().c,
  syncQueue: db.prepare('SELECT COUNT(*) AS c FROM sync_queue').get().c,
  auditLogs: db.prepare('SELECT COUNT(*) AS c FROM audit_logs').get().c,
  archived: db.prepare('SELECT COUNT(*) AS c FROM products WHERE is_active = 0').get().c,
  products: db.prepare('SELECT COUNT(*) AS c FROM products').get().c,
  categories: db.prepare('SELECT COUNT(*) AS c FROM categories').get().c,
  users: db.prepare('SELECT COUNT(*) AS c FROM users').get().c,
};

db.close();

console.log(`[Reset] Cleared local DB at ${dbPath}`);
console.log(`[Reset] Removed: invoices=${before.invoices}, invoice_items=${before.invoiceItems}, returns=${before.returns}, stock_movements=${before.movements}, sync_queue=${before.syncQueue}, audit_logs=${before.auditLogs}, approvals=${before.approvals}, archived_products=${before.archived}`);
console.log(`[Reset] Kept: active_products=${before.activeProducts} (now ${after.products}), categories=${after.categories}, users=${after.users}`);
console.log(`[Reset] Remaining: invoices=${after.invoices}, movements=${after.movements}, sync=${after.syncQueue}, audit=${after.auditLogs}, archived=${after.archived}`);
