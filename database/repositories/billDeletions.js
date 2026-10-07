/**
 * Bill item deletions — audit trail when cashiers remove lines from open bills.
 */

const { v4: uuidv4 } = require('uuid');

class BillDeletionsRepository {
  constructor(db) {
    this.db = db;
  }

  create({
    id,
    billReference,
    productId,
    productName,
    itemCode,
    quantity,
    unit,
    unitPrice,
    lineAmount,
    cashierId,
    cashierName,
    deviceId,
    message,
  }) {
    const rowId = id || uuidv4();
    this.db.prepare(`
      INSERT INTO bill_item_deletions (
        id, bill_reference, product_id, product_name, item_code,
        quantity, unit, unit_price, line_amount,
        cashier_id, cashier_name, device_id, message,
        seen_by_admin, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
    `).run(
      rowId,
      billReference,
      productId || null,
      productName,
      itemCode || null,
      quantity,
      unit || 'PCS',
      unitPrice ?? 0,
      lineAmount ?? 0,
      cashierId || null,
      cashierName || 'Cashier',
      deviceId || 'POS-TERMINAL',
      message
    );

    return { success: true, id: rowId };
  }

  list({ limit = 100, billReference, cashierId, unseenByAdminOnly = false } = {}) {
    const conditions = [];
    const params = [];

    if (billReference) {
      conditions.push('bill_reference = ?');
      params.push(billReference);
    }
    if (cashierId) {
      conditions.push('cashier_id = ?');
      params.push(cashierId);
    }
    if (unseenByAdminOnly) {
      conditions.push('seen_by_admin = 0');
    }

    let query = 'SELECT * FROM bill_item_deletions';
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(query).all(...params);
    return { success: true, deletions: rows };
  }

  markAdminSeen({ ids }) {
    if (!ids || ids.length === 0) {
      this.db.prepare(`
        UPDATE bill_item_deletions SET seen_by_admin = 1 WHERE seen_by_admin = 0
      `).run();
      return { success: true };
    }

    const placeholders = ids.map(() => '?').join(',');
    this.db.prepare(`
      UPDATE bill_item_deletions SET seen_by_admin = 1 WHERE id IN (${placeholders})
    `).run(...ids);

    return { success: true };
  }

  countUnseenAdmin() {
    const row = this.db.prepare(`
      SELECT COUNT(*) as count FROM bill_item_deletions WHERE seen_by_admin = 0
    `).get();
    return { success: true, count: row?.count || 0 };
  }
}

module.exports = { BillDeletionsRepository };
