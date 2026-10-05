/**
 * Sync Conflict Resolver
 * Defines conflict resolution rules between local SQLite and cloud D1.
 * 
 * Rules:
 * 1. Transactions (Invoices & Returns) are immutable local events:
 *    Local terminal sales are source of truth for transactions generated on that terminal.
 * 2. Master Data (Products & Pricing):
 *    Cloud version takes precedence if cloud.version > local.version.
 * 3. Idempotency:
 *    D1 uses unique IDs + device_id to ignore re-transmitted duplicates.
 */

class ConflictResolver {
  /**
   * Resolve product conflict between local and cloud payload
   */
  static resolveProduct(localProduct, cloudProduct) {
    if (!localProduct) {
      return { action: 'INSERT', data: cloudProduct };
    }

    const localVersion = localProduct.version || 1;
    const cloudVersion = cloudProduct.version || 1;

    if (cloudVersion > localVersion) {
      return { action: 'UPDATE', data: cloudProduct };
    }

    // Local is same or newer
    return { action: 'SKIP', data: localProduct };
  }

  /**
   * Determine if transaction is safe to commit
   */
  static validateTransactionIdempotency(db, entityType, entityId) {
    if (entityType === 'INVOICE') {
      const existing = db.prepare('SELECT id FROM invoices WHERE id = ?').get(entityId);
      return !existing;
    }
    if (entityType === 'SALES_RETURN') {
      const existing = db.prepare('SELECT id FROM sales_returns WHERE id = ?').get(entityId);
      return !existing;
    }
    return true;
  }
}

module.exports = { ConflictResolver };
