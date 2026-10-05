/**
 * Migration 003: Approval Requests
 * Used for manager/admin overrides and real-time approval of wholesale mode, discounts, and voids.
 */

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS approval_requests (
      id TEXT PRIMARY KEY,
      request_type TEXT NOT NULL,
      cashier_id TEXT,
      cashier_name TEXT,
      device_id TEXT,
      details TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
      approved_by TEXT,
      approved_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

module.exports = { up };
