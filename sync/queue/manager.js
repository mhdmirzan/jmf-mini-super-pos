/**
 * Sync Queue Manager
 * Manages queue lifecycle in local SQLite database.
 * Tracks PENDING, SYNCING, SYNCED, FAILED states with retry counting.
 */

class SyncQueueManager {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get pending items ready for sync
   */
  getPending(limit = 25) {
    return this.db.prepare(`
      SELECT * FROM sync_queue 
      WHERE status IN ('PENDING', 'FAILED')
      ORDER BY created_at ASC 
      LIMIT ?
    `).all(limit);
  }

  /**
   * Mark items as currently syncing
   */
  markSyncing(ids) {
    if (!ids || ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    this.db.prepare(`
      UPDATE sync_queue 
      SET status = 'SYNCING', attempts = attempts + 1
      WHERE id IN (${placeholders})
    `).run(...ids);
  }

  /**
   * Mark item as successfully synced
   */
  markSynced(id) {
    this.db.prepare(`
      UPDATE sync_queue 
      SET status = 'SYNCED', synced_at = datetime('now'), last_error = NULL
      WHERE id = ?
    `).run(id);
  }

  /**
   * Mark item as failed with error message
   */
  markFailed(id, errorMessage) {
    this.db.prepare(`
      UPDATE sync_queue 
      SET status = 'FAILED', last_error = ?
      WHERE id = ?
    `).run(String(errorMessage).substring(0, 500), id);
  }

  /**
   * Get sync queue summary statistics
   */
  getStats() {
    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END), 0) as pending,
        COALESCE(SUM(CASE WHEN status = 'SYNCING' THEN 1 ELSE 0 END), 0) as syncing,
        COALESCE(SUM(CASE WHEN status = 'SYNCED' THEN 1 ELSE 0 END), 0) as synced,
        COALESCE(SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END), 0) as failed
      FROM sync_queue
    `).get();

    return stats;
  }
}

module.exports = { SyncQueueManager };
