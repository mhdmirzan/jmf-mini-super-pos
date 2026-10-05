/**
 * Audit Repository - Read-only access to audit logs.
 */

class AuditRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * List audit logs with optional filters.
   */
  list(filters = {}) {
    let query = `
      SELECT al.*, u.full_name as user_name, u.username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
    `;
    const params = [];
    const conditions = [];

    if (filters.action) {
      conditions.push('al.action = ?');
      params.push(filters.action);
    }
    if (filters.userId) {
      conditions.push('al.user_id = ?');
      params.push(filters.userId);
    }
    if (filters.entityType) {
      conditions.push('al.entity_type = ?');
      params.push(filters.entityType);
    }
    if (filters.dateFrom) {
      conditions.push('al.created_at >= ?');
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      conditions.push('al.created_at <= ?');
      params.push(filters.dateTo);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY al.created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    } else {
      query += ' LIMIT 500';
    }

    const logs = this.db.prepare(query).all(...params);
    return { success: true, logs };
  }
}

module.exports = { AuditRepository };
