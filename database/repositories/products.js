/**
 * Products Repository - CRUD operations for products.
 * Handles product search by item code and text.
 */

const { v4: uuidv4 } = require('uuid');

class ProductRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Create a new product.
   */
  create({ id: providedId, itemCode, itemName, unit, quantity, minimumQuantity, cost, retailPrice, retailDiscount, wholesalePrice, createdBy }) {
    const existing = this.db.prepare('SELECT id FROM products WHERE item_code = ?').get(itemCode);
    if (existing) {
      return { success: false, error: 'Item code already exists.' };
    }

    const id = providedId || uuidv4();
    const finalUnit = (unit && String(unit).trim().toUpperCase() === 'KG') ? 'KG' : 'PCS';
    this.db.prepare(
      `INSERT INTO products (id, item_code, item_name, unit, quantity, minimum_quantity, cost, retail_price, retail_discount, wholesale_price, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`
    ).run(id, itemCode, itemName, finalUnit, quantity || 0, minimumQuantity || 0, cost || 0, retailPrice || 0, retailDiscount || 0, wholesalePrice || 0);

    if (quantity && quantity > 0) {
      let validUserId = createdBy;
      if (validUserId) {
        const userExists = this.db.prepare('SELECT id FROM users WHERE id = ?').get(validUserId);
        if (!userExists) {
          const userByName = this.db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(validUserId);
          validUserId = userByName ? userByName.id : null;
        }
      }
      if (!validUserId) {
        const fallbackUser = this.db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get();
        validUserId = fallbackUser ? fallbackUser.id : null;
      }

      if (validUserId) {
        this.db.prepare(
          `INSERT INTO stock_movements (id, product_id, movement_type, quantity, reference_type, reference_id, reason, created_by, created_at)
           VALUES (?, ?, 'PURCHASE', ?, 'PRODUCT_CREATION', ?, 'Initial stock', ?, datetime('now'))`
        ).run(uuidv4(), id, quantity, id, validUserId);
      }
    }

    return { success: true, id };
  }

  /**
   * Update a product.
   */
  update({ id, itemCode, itemName, unit, minimumQuantity, cost, retailPrice, retailDiscount, wholesalePrice, isActive, updatedBy }) {
    const product = this.db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!product) {
      return { success: false, error: 'Product not found.' };
    }

    if (itemCode && itemCode !== product.item_code) {
      const existing = this.db.prepare('SELECT id FROM products WHERE item_code = ? AND id != ?').get(itemCode, id);
      if (existing) {
        return { success: false, error: 'Item code already exists.' };
      }
    }

    const priceChanged = (retailPrice !== undefined && retailPrice !== product.retail_price) ||
      (wholesalePrice !== undefined && wholesalePrice !== product.wholesale_price) ||
      (cost !== undefined && cost !== product.cost);

    const finalUnit = (unit !== undefined && unit !== null)
      ? (String(unit).trim().toUpperCase() === 'KG' ? 'KG' : 'PCS')
      : (product.unit || 'PCS');

    this.db.prepare(
      `UPDATE products SET
        item_code = COALESCE(?, item_code),
        item_name = COALESCE(?, item_name),
        unit = ?,
        minimum_quantity = COALESCE(?, minimum_quantity),
        cost = COALESCE(?, cost),
        retail_price = COALESCE(?, retail_price),
        retail_discount = COALESCE(?, retail_discount),
        wholesale_price = COALESCE(?, wholesale_price),
        is_active = COALESCE(?, is_active),
        updated_at = datetime('now'),
        version = version + 1
      WHERE id = ?`
    ).run(
      itemCode || null, itemName || null, finalUnit,
      minimumQuantity !== undefined ? minimumQuantity : null,
      cost !== undefined ? cost : null, retailPrice !== undefined ? retailPrice : null,
      retailDiscount !== undefined ? retailDiscount : null,
      wholesalePrice !== undefined ? wholesalePrice : null,
      isActive !== undefined ? (isActive ? 1 : 0) : null, id
    );

    if (priceChanged && updatedBy) {
      this.db.prepare(
        "INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
      ).run(uuidv4(), updatedBy, 'PRICE_CHANGE', 'PRODUCT', id, JSON.stringify({
        itemName: product.item_name,
        oldRetail: product.retail_price,
        newRetail: retailPrice,
        oldWholesale: product.wholesale_price,
        newWholesale: wholesalePrice,
        oldCost: product.cost,
        newCost: cost,
      }));
    }

    return { success: true };
  }

  list(filters = {}) {
    let query = 'SELECT p.* FROM products p';
    const params = [];
    const conditions = [];

    if (filters.isActive !== undefined) {
      conditions.push('p.is_active = ?');
      params.push(filters.isActive ? 1 : 0);
    }
    if (filters.search && filters.search.trim()) {
      conditions.push('(p.item_code LIKE ? OR p.item_name LIKE ?)');
      const term = `%${filters.search.trim()}%`;
      params.push(term, term);
    }
    if (filters.lowStock) {
      conditions.push('p.quantity <= p.minimum_quantity');
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY p.item_name ASC';

    const products = this.db.prepare(query).all(...params);
    return { success: true, products };
  }

  get(id) {
    const product = this.db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!product) {
      return { success: false, error: 'Product not found.' };
    }
    return { success: true, product };
  }

  search(query) {
    if (!query || query.trim() === '') {
      return { success: true, products: [] };
    }
    const searchTerm = `%${query}%`;
    const products = this.db.prepare(`
      SELECT * FROM products
      WHERE is_active = 1 AND (
        item_code LIKE ? OR
        item_name LIKE ?
      )
      ORDER BY item_name ASC
      LIMIT 50
    `).all(searchTerm, searchTerm);
    return { success: true, products };
  }

  getByItemCode(itemCode) {
    const product = this.db.prepare(`
      SELECT * FROM products
      WHERE item_code = ? AND is_active = 1
    `).get(itemCode);
    if (!product) {
      return { success: false, error: 'Product not found.' };
    }
    return { success: true, product };
  }

  delete(id) {
    const product = this.db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!product) {
      return { success: false, error: 'Product not found.' };
    }

    const hasInvoices = this.db.prepare('SELECT COUNT(*) as count FROM invoice_items WHERE product_id = ?').get(id).count > 0;
    const hasReturns = this.db.prepare('SELECT COUNT(*) as count FROM sales_return_items WHERE product_id = ?').get(id).count > 0;

    if (hasInvoices || hasReturns) {
      this.db.prepare("UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
      return {
        success: true,
        message: `Product "${product.item_name}" has past invoice/sales records. It has been deactivated and archived from active stock.`,
        deactivated: true
      };
    }

    const deleteTx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM stock_movements WHERE product_id = ?').run(id);
      this.db.prepare('DELETE FROM products WHERE id = ?').run(id);
    });
    deleteTx();

    return {
      success: true,
      message: `Product "${product.item_name}" has been permanently deleted.`,
      deleted: true
    };
  }
}

module.exports = { ProductRepository };
