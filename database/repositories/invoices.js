/**
 * Invoices Repository - Handles invoice creation and cancellation.
 * Invoice creation is a single SQLite transaction covering:
 * 1. Validate products and stock
 * 2. Create invoice
 * 3. Create invoice items (historical snapshot)
 * 4. Decrease stock
 * 5. Create stock movements
 * 6. Add to sync queue
 */

const { v4: uuidv4 } = require('uuid');

class InvoiceRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Generate next invoice number.
   */
  _generateInvoiceNumber() {
    const prefix = this.db.prepare(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'INVOICE_PREFIX'"
    ).get();
    const pre = prefix ? prefix.setting_value : 'INV';

    const lastInvoice = this.db.prepare(
      "SELECT invoice_number FROM invoices ORDER BY created_at DESC LIMIT 1"
    ).get();

    let nextNum = 1;
    if (lastInvoice) {
      const match = lastInvoice.invoice_number.match(/(\d+)$/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }

    return `${pre}-${String(nextNum).padStart(6, '0')}`;
  }

  /**
   * Create an invoice. This is ONE SQLite transaction.
   * The most critical operation in the system.
   */
  create({ cashierId, items, paymentMethod, cashReceived, deviceId }) {
    const createTransaction = this.db.transaction(() => {
      // 1. Validate all products and stock
      const validatedItems = [];
      for (const item of items) {
        const product = this.db.prepare(
          'SELECT * FROM products WHERE id = ? AND is_active = 1'
        ).get(item.productId);

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        if (product.quantity < item.quantity) {
          throw new Error(`Insufficient stock for ${product.item_name}. Available: ${product.quantity}`);
        }

        if (item.quantity <= 0) {
          throw new Error(`Invalid quantity for ${product.item_name}.`);
        }

        const unitPrice = (item.unitPrice !== undefined && item.unitPrice !== null) ? Number(item.unitPrice) : product.retail_price;
        const unitDiscount = (item.unitDiscount !== undefined && item.unitDiscount !== null) ? Number(item.unitDiscount) : (product.retail_discount || 0);
        const discount = Math.round(unitDiscount * item.quantity * 100) / 100;
        const amount = Math.round(((unitPrice * item.quantity) - discount) * 100) / 100;

        validatedItems.push({
          ...item,
          product,
          unitPrice,
          unitDiscount,
          discount,
          amount,
        });
      }

      // 2. Calculate totals
      const subtotal = Math.round(validatedItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0) * 100) / 100;
      const totalDiscount = Math.round(validatedItems.reduce((sum, item) => sum + item.discount, 0) * 100) / 100;
      const totalAmount = Math.max(0, Math.round((subtotal - totalDiscount) * 100) / 100);

      // 3. Calculate cash change
      let cashChange = null;
      if (paymentMethod === 'CASH') {
        if (!cashReceived || cashReceived < totalAmount) {
          throw new Error('Insufficient cash received.');
        }
        cashChange = Math.round((cashReceived - totalAmount) * 100) / 100;
      }

      // 4. Create invoice
      const invoiceId = uuidv4();
      const invoiceNumber = this._generateInvoiceNumber();

      this.db.prepare(
        `INSERT INTO invoices (id, invoice_number, cashier_id, subtotal, total_discount, total_amount, payment_method, cash_received, cash_change, status, device_id, sync_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, 'PENDING', datetime('now'), datetime('now'))`
      ).run(invoiceId, invoiceNumber, cashierId, subtotal, totalDiscount, totalAmount, paymentMethod, cashReceived || null, cashChange, deviceId || null);

      // 5. Create invoice items (historical snapshot)
      const insertItem = this.db.prepare(
        `INSERT INTO invoice_items (id, invoice_id, product_id, item_code, item_name, unit_price, quantity, unit_discount, discount, amount, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      );

      for (const item of validatedItems) {
        insertItem.run(
          uuidv4(), invoiceId, item.product.id,
          item.product.item_code, item.product.item_name,
          item.unitPrice, item.quantity, item.unitDiscount,
          item.discount, item.amount
        );
      }

      // 6. Decrease stock and create stock movements
      const updateStock = this.db.prepare(
        "UPDATE products SET quantity = quantity - ?, updated_at = datetime('now') WHERE id = ?"
      );
      const insertMovement = this.db.prepare(
        `INSERT INTO stock_movements (id, product_id, movement_type, quantity, reference_type, reference_id, reason, created_by, created_at)
         VALUES (?, ?, 'SALE', ?, 'INVOICE', ?, 'Sale', ?, datetime('now'))`
      );

      for (const item of validatedItems) {
        updateStock.run(item.quantity, item.product.id);
        insertMovement.run(uuidv4(), item.product.id, -item.quantity, invoiceId, cashierId);
      }

      // 7. Add to sync queue
      this.db.prepare(
        `INSERT INTO sync_queue (id, entity_type, entity_id, operation, payload, status, created_at)
         VALUES (?, 'INVOICE', ?, 'CREATE', ?, 'PENDING', datetime('now'))`
      ).run(uuidv4(), invoiceId, JSON.stringify({ invoiceId, invoiceNumber }));

      return {
        success: true,
        invoice: {
          id: invoiceId,
          invoiceNumber,
          subtotal,
          totalDiscount,
          totalAmount,
          paymentMethod,
          cashReceived: cashReceived || null,
          cashChange,
          items: validatedItems.map(item => ({
            productId: item.product.id,
            itemCode: item.product.item_code,
            itemName: item.product.item_name,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            unitDiscount: item.unitDiscount,
            discount: item.discount,
            amount: item.amount,
          })),
        },
      };
    });

    try {
      return createTransaction();
    } catch (error) {
      console.error('[Invoice] Transaction failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cancel an invoice. Reverses stock.
   */
  cancel({ invoiceId, cancelledBy, reason }) {
    const cancelTransaction = this.db.transaction(() => {
      const invoice = this.db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found.');
      }
      if (invoice.status === 'CANCELLED') {
        throw new Error('Invoice is already cancelled.');
      }

      // Mark invoice as cancelled
      this.db.prepare(
        `UPDATE invoices SET status = 'CANCELLED', cancelled_by = ?, cancelled_at = datetime('now'), cancellation_reason = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(cancelledBy, reason, invoiceId);

      // Get invoice items and reverse stock
      const invoiceItems = this.db.prepare(
        'SELECT * FROM invoice_items WHERE invoice_id = ?'
      ).all(invoiceId);

      const updateStock = this.db.prepare(
        "UPDATE products SET quantity = quantity + ?, updated_at = datetime('now') WHERE id = ?"
      );
      const insertMovement = this.db.prepare(
        `INSERT INTO stock_movements (id, product_id, movement_type, quantity, reference_type, reference_id, reason, created_by, created_at)
         VALUES (?, ?, 'RETURN', ?, 'INVOICE_CANCELLATION', ?, ?, ?, datetime('now'))`
      );

      for (const item of invoiceItems) {
        updateStock.run(item.quantity, item.product_id);
        insertMovement.run(
          uuidv4(), item.product_id, item.quantity,
          invoiceId, `Invoice cancellation: ${reason}`, cancelledBy
        );
      }

      // Audit log
      this.db.prepare(
        "INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
      ).run(uuidv4(), cancelledBy, 'INVOICE_CANCELLED', 'INVOICE', invoiceId, JSON.stringify({
        invoiceNumber: invoice.invoice_number,
        reason,
        totalAmount: invoice.total_amount,
      }));

      // Add to sync queue
      this.db.prepare(
        `INSERT INTO sync_queue (id, entity_type, entity_id, operation, payload, status, created_at)
         VALUES (?, 'INVOICE', ?, 'CANCEL', ?, 'PENDING', datetime('now'))`
      ).run(uuidv4(), invoiceId, JSON.stringify({ invoiceId, reason }));

      return { success: true };
    });

    try {
      return cancelTransaction();
    } catch (error) {
      console.error('[Invoice] Cancellation failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * List invoices with optional filters.
   */
  list(filters = {}) {
    let query = `
      SELECT i.*, u.full_name as cashier_name, u.username as cashier_username
      FROM invoices i
      LEFT JOIN users u ON i.cashier_id = u.id
    `;
    const params = [];
    const conditions = [];

    if (filters.status) {
      conditions.push('i.status = ?');
      params.push(filters.status);
    }
    if (filters.cashierId) {
      conditions.push('i.cashier_id = ?');
      params.push(filters.cashierId);
    }
    if (filters.dateFrom) {
      conditions.push('i.created_at >= ?');
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      conditions.push('i.created_at <= ?');
      params.push(filters.dateTo);
    }
    if (filters.search) {
      conditions.push('i.invoice_number LIKE ?');
      params.push(`%${filters.search}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY i.created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const invoices = this.db.prepare(query).all(...params);
    return { success: true, invoices };
  }

  /**
   * Get a single invoice with its items.
   */
  get(id) {
    const invoice = this.db.prepare(`
      SELECT i.*, u.full_name as cashier_name, u.username as cashier_username
      FROM invoices i
      LEFT JOIN users u ON i.cashier_id = u.id
      WHERE i.id = ?
    `).get(id);

    if (!invoice) {
      return { success: false, error: 'Invoice not found.' };
    }

    const items = this.db.prepare(`
      SELECT ii.*, COALESCE(p.unit, 'PCS') as unit
      FROM invoice_items ii
      LEFT JOIN products p ON ii.product_id = p.id
      WHERE ii.invoice_id = ?
    `).all(id);

    return { success: true, invoice: { ...invoice, items } };
  }
}

module.exports = { InvoiceRepository };
