/**
 * Stock Repository - Handles stock adjustments and movements.
 */

const { v4: uuidv4 } = require('uuid');

class StockRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Manually adjust stock for a product.
   * Records the adjustment as a stock movement.
   */
  adjust({ productId, quantity, reason, adjustedBy }) {
    const adjustTransaction = this.db.transaction(() => {
      const product = this.db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
      if (!product) {
        throw new Error('Product not found.');
      }

      const newQuantity = product.quantity + quantity;
      if (newQuantity < 0) {
        throw new Error('Stock cannot be negative.');
      }

      // Update product quantity
      this.db.prepare(
        "UPDATE products SET quantity = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(newQuantity, productId);

      // Create stock movement
      this.db.prepare(
        `INSERT INTO stock_movements (id, product_id, movement_type, quantity, reference_type, reference_id, reason, created_by, created_at)
         VALUES (?, ?, 'ADJUSTMENT', ?, 'MANUAL', ?, ?, ?, datetime('now'))`
      ).run(uuidv4(), productId, quantity, productId, reason || 'Manual adjustment', adjustedBy);

      // Audit log
      this.db.prepare(
        "INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
      ).run(uuidv4(), adjustedBy, 'STOCK_ADJUSTMENT', 'PRODUCT', productId, JSON.stringify({
        itemName: product.item_name,
        oldQuantity: product.quantity,
        adjustedBy: quantity,
        newQuantity,
        reason,
      }));

      // Sync queue
      this.db.prepare(
        `INSERT INTO sync_queue (id, entity_type, entity_id, operation, payload, status, created_at)
         VALUES (?, 'STOCK_MOVEMENT', ?, 'CREATE', ?, 'PENDING', datetime('now'))`
      ).run(uuidv4(), productId, JSON.stringify({ productId, quantity, reason }));

      return { success: true, newQuantity };
    });

    try {
      return adjustTransaction();
    } catch (error) {
      console.error('[Stock] Adjustment failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get stock movements with optional filters.
   */
  getMovements(filters = {}) {
    let query = `
      SELECT sm.*, p.item_name, p.item_code, u.full_name as created_by_name
      FROM stock_movements sm
      LEFT JOIN products p ON sm.product_id = p.id
      LEFT JOIN users u ON sm.created_by = u.id
    `;
    const params = [];
    const conditions = [];

    if (filters.productId) {
      conditions.push('sm.product_id = ?');
      params.push(filters.productId);
    }
    if (filters.movementType) {
      conditions.push('sm.movement_type = ?');
      params.push(filters.movementType);
    }
    if (filters.dateFrom) {
      conditions.push('sm.created_at >= ?');
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      conditions.push('sm.created_at <= ?');
      params.push(filters.dateTo);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY sm.created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const movements = this.db.prepare(query).all(...params);
    return { success: true, movements };
  }
}

module.exports = { StockRepository };
