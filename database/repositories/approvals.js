/**
 * Approvals Repository
 * Manages approval requests for sensitive cashier actions (Wholesale price mode, discounts, void bills)
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

class ApprovalRepository {
  constructor(db) {
    this.db = db;
  }

  create({ id, requestType = 'WHOLESALE_MODE', cashierId, cashierName, deviceId, details = '' }) {
    const reqId = id || uuidv4();
    this.db.prepare(`
      INSERT OR REPLACE INTO approval_requests (
        id, request_type, cashier_id, cashier_name, device_id, details,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', datetime('now'), datetime('now'))
    `).run(reqId, requestType, cashierId || null, cashierName || 'Cashier', deviceId || 'POS-TERMINAL', details);

    return { success: true, requestId: reqId };
  }

  getPending() {
    const rows = this.db.prepare(`
      SELECT * FROM approval_requests
      WHERE status = 'PENDING'
      ORDER BY created_at DESC
      LIMIT 20
    `).all();

    return { success: true, requests: rows };
  }

  checkStatus(id) {
    const row = this.db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(id);
    if (!row) {
      return { success: false, error: 'Request not found' };
    }
    return { success: true, request: row };
  }

  respond({ requestId, status, approvedBy, approvedByName, details = '', requestType = 'WHOLESALE_BILL', cashierName = 'Cashier', cashierId = null }) {
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return { success: false, error: 'Invalid approval status' };
    }

    const existing = this.db.prepare('SELECT id FROM approval_requests WHERE id = ?').get(requestId);
    if (!existing) {
      this.db.prepare(`
        INSERT INTO approval_requests (
          id, request_type, cashier_id, cashier_name, device_id, details,
          status, approved_by, approved_by_name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'REMOTE', ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(requestId, requestType, cashierId, cashierName, details, status, approvedBy || null, approvedByName || null);
      return { success: true, status };
    }

    this.db.prepare(`
      UPDATE approval_requests
      SET status = ?,
          approved_by = ?,
          approved_by_name = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(status, approvedBy || null, approvedByName || null, requestId);

    return { success: true, status };
  }

  verifyAdmin({ username, password }) {
    if (!username || !password) {
      return { success: false, error: 'Username and password are required' };
    }

    const user = this.db.prepare(`
      SELECT * FROM users
      WHERE LOWER(username) = LOWER(?) AND is_active = 1
    `).get(username.trim());

    if (!user) {
      return { success: false, error: 'User not found or inactive' };
    }

    const role = (user.role || '').toUpperCase();
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      return { success: false, error: 'Only Admin or Super Admin can approve wholesale mode' };
    }

    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) {
      return { success: false, error: 'Invalid admin password' };
    }

    return {
      success: true,
      approver: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
      },
    };
  }
}

module.exports = { ApprovalRepository };
