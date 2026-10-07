/**
 * Returns Repository - Handles sales returns.
 * Creates return record and reverses stock.
 */

const { v4: uuidv4 } = require('uuid');

class ReturnsRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Generate next return number.
   */
  _generateReturnNumber() {
    const prefix = this.db.prepare(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'RETURN_PREFIX'"
    ).get();
    const pre = prefix ? prefix.setting_value : 'RET';

    const lastReturn = this.db.prepare(
      "SELECT return_number FROM sales_returns ORDER BY created_at DESC LIMIT 1"
    ).get();

    let nextNum = 1;
    if (lastReturn) {
      const match = lastReturn.return_number.match(/(\d+)$/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }

    return `${pre}-${String(nextNum).padStart(6, '0')}`;
  }

  /**
   * Create a sales return. Single transaction.
   */
  create({ originalInvoiceId, reason, processedBy, items, deviceId }) {
    const createTransaction = this.db.transaction(() => {
      // Validate invoice
      const invoice = this.db.prepare(
        'SELECT * FROM invoices WHERE id = ? AND status = ?'
      ).get(originalInvoiceId, 'COMPLETED');

      if (!invoice) {
        throw new Error('Invoice not found or is not in COMPLETED status.');
      }

      // Safeguard processedBy to ensure NOT NULL and FK constraints are never violated
      let userId = processedBy;
      if (!userId) {
        const defaultUser = this.db.prepare("SELECT id FROM users ORDER BY (role = 'SUPER_ADMIN') DESC LIMIT 1").get();
        userId = defaultUser ? defaultUser.id : null;
      }

      const returnId = uuidv4();
      const returnNumber = this._generateReturnNumber();

      // Create return record
      this.db.prepare(
        `INSERT INTO sales_returns (id, return_number, original_invoice_id, reason, processed_by, device_id, sync_status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'PENDING', datetime('now'))`
      ).run(returnId, returnNumber, originalInvoiceId, reason, userId, deviceId || null);

      // Process each return item
      const insertReturnItem = this.db.prepare(
        `INSERT INTO sales_return_items (id, return_id, invoice_item_id, product_id, item_code, item_name, sales_price, quantity, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      );
      const updateStock = this.db.prepare(
        "UPDATE products SET quantity = quantity + ?, updated_at = datetime('now'), version = version + 1 WHERE id = ?"
      );
      const insertMovement = this.db.prepare(
        `INSERT INTO stock_movements (id, product_id, movement_type, quantity, reference_type, reference_id, reason, created_by, created_at)
         VALUES (?, ?, 'RETURN', ?, 'SALES_RETURN', ?, ?, ?, datetime('now'))`
      );

      for (const item of items) {
        // Validate invoice item
        const invoiceItem = this.db.prepare(
          'SELECT * FROM invoice_items WHERE id = ? AND invoice_id = ?'
        ).get(item.invoiceItemId, originalInvoiceId);

        if (!invoiceItem) {
          throw new Error(`Invoice item not found: ${item.invoiceItemId}`);
        }

        if (item.quantity <= 0 || item.quantity > invoiceItem.quantity) {
          throw new Error(`Invalid return quantity for ${invoiceItem.item_name}.`);
        }

        // Insert return item
        insertReturnItem.run(
          uuidv4(), returnId, item.invoiceItemId,
          invoiceItem.product_id, invoiceItem.item_code, invoiceItem.item_name,
          invoiceItem.unit_price, item.quantity,
          item.reason || reason
        );

        // Increase stock
        updateStock.run(item.quantity, invoiceItem.product_id);

        // Create stock movement
        insertMovement.run(
          uuidv4(), invoiceItem.product_id, item.quantity,
          returnId, `Sales return: ${item.reason || reason}`, userId
        );
      }

      // Audit log
      this.db.prepare(
        "INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
      ).run(uuidv4(), userId, 'SALES_RETURN', 'SALES_RETURN', returnId, JSON.stringify({
        returnNumber,
        invoiceNumber: invoice.invoice_number,
        reason,
        itemCount: items.length,
      }));

      // Add to sync queue
      this.db.prepare(
        `INSERT INTO sync_queue (id, entity_type, entity_id, operation, payload, status, created_at)
         VALUES (?, 'SALES_RETURN', ?, 'CREATE', ?, 'PENDING', datetime('now'))`
      ).run(uuidv4(), returnId, JSON.stringify({ returnId, returnNumber }));

      return { success: true, returnId, returnNumber, return: { id: returnId, returnNumber } };
    });

    try {
      return createTransaction();
    } catch (error) {
      console.error('[Returns] Transaction failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * List returns.
   */
  list(filters = {}) {
    let query = `
      SELECT sr.*, i.invoice_number, u.full_name as processed_by_name
      FROM sales_returns sr
      LEFT JOIN invoices i ON sr.original_invoice_id = i.id
      LEFT JOIN users u ON sr.processed_by = u.id
    `;
    const params = [];
    const conditions = [];

    if (filters.dateFrom) {
      conditions.push('sr.created_at >= ?');
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      conditions.push('sr.created_at <= ?');
      params.push(filters.dateTo);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY sr.created_at DESC';

    const returns = this.db.prepare(query).all(...params);
    return { success: true, returns };
  }

  /**
   * Get a return with items.
   */
  get(id) {
    const returnRecord = this.db.prepare(`
      SELECT sr.*, i.invoice_number, u.full_name as processed_by_name
      FROM sales_returns sr
      LEFT JOIN invoices i ON sr.original_invoice_id = i.id
      LEFT JOIN users u ON sr.processed_by = u.id
      WHERE sr.id = ?
    `).get(id);

    if (!returnRecord) {
      return { success: false, error: 'Return not found.' };
    }

    const items = this.db.prepare(
      'SELECT * FROM sales_return_items WHERE return_id = ?'
    ).all(id);

    return { success: true, return: { ...returnRecord, items } };
  }
}

module.exports = { ReturnsRepository };
