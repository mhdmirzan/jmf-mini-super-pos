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
  create({ id: providedId, itemCode, categoryId, subCategoryId, itemName, unit, quantity, minimumQuantity, cost, retailPrice, retailDiscount, wholesalePrice, createdBy }) {
    // Check item_code uniqueness
    const existing = this.db.prepare('SELECT id FROM products WHERE item_code = ?').get(itemCode);
    if (existing) {
      return { success: false, error: 'Item code already exists.' };
    }

    const id = providedId || uuidv4();
    const finalUnit = (unit && String(unit).trim().toUpperCase() === 'KG') ? 'KG' : 'PCS';
    this.db.prepare(
      `INSERT INTO products (id, item_code, category_id, sub_category_id, item_name, unit, quantity, minimum_quantity, cost, retail_price, retail_discount, wholesale_price, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`
    ).run(id, itemCode, categoryId || null, subCategoryId || null, itemName, finalUnit, quantity || 0, minimumQuantity || 0, cost || 0, retailPrice || 0, retailDiscount || 0, wholesalePrice || 0);

    // Stock movement for initial quantity
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
  update({ id, itemCode, categoryId, subCategoryId, itemName, unit, minimumQuantity, cost, retailPrice, retailDiscount, wholesalePrice, isActive, updatedBy }) {
    const product = this.db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!product) {
      return { success: false, error: 'Product not found.' };
    }

    // Check item_code uniqueness if changed
    if (itemCode && itemCode !== product.item_code) {
      const existing = this.db.prepare('SELECT id FROM products WHERE item_code = ? AND id != ?').get(itemCode, id);
      if (existing) {
        return { success: false, error: 'Item code already exists.' };
      }
    }

    // Track price changes for audit
    const priceChanged = (retailPrice !== undefined && retailPrice !== product.retail_price) ||
      (wholesalePrice !== undefined && wholesalePrice !== product.wholesale_price) ||
      (cost !== undefined && cost !== product.cost);

    const finalUnit = (unit !== undefined && unit !== null)
      ? (String(unit).trim().toUpperCase() === 'KG' ? 'KG' : 'PCS')
      : (product.unit || 'PCS');

    this.db.prepare(
      `UPDATE products SET
        item_code = COALESCE(?, item_code),
        category_id = COALESCE(?, category_id),
        sub_category_id = COALESCE(?, sub_category_id),
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
      itemCode || null, categoryId || null, subCategoryId || null,
      itemName || null, finalUnit, minimumQuantity !== undefined ? minimumQuantity : null,
      cost !== undefined ? cost : null, retailPrice !== undefined ? retailPrice : null,
      retailDiscount !== undefined ? retailDiscount : null,
      wholesalePrice !== undefined ? wholesalePrice : null,
      isActive !== undefined ? (isActive ? 1 : 0) : null, id
    );

    // Audit price change
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

  /**
   * List products with optional filters.
   */
  list(filters = {}) {
    let query = `
      SELECT p.*, c.name as category_name, sc.name as sub_category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN sub_categories sc ON p.sub_category_id = sc.id
    `;
    const params = [];
    const conditions = [];

    if (filters.isActive !== undefined) {
      conditions.push('p.is_active = ?');
      params.push(filters.isActive ? 1 : 0);
    }
    if (filters.categoryId) {
      conditions.push('p.category_id = ?');
      params.push(filters.categoryId);
    }
    if (filters.subCategoryId) {
      conditions.push('p.sub_category_id = ?');
      params.push(filters.subCategoryId);
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

  /**
   * Get a single product by ID.
   */
  get(id) {
    const product = this.db.prepare(`
      SELECT p.*, c.name as category_name, sc.name as sub_category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN sub_categories sc ON p.sub_category_id = sc.id
      WHERE p.id = ?
    `).get(id);
    if (!product) {
      return { success: false, error: 'Product not found.' };
    }
    return { success: true, product };
  }

  /**
   * Search products by item code or name.
   */
  search(query) {
    if (!query || query.trim() === '') {
      return { success: true, products: [] };
    }
    const searchTerm = `%${query}%`;
    const products = this.db.prepare(`
      SELECT p.*, c.name as category_name, sc.name as sub_category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN sub_categories sc ON p.sub_category_id = sc.id
      WHERE p.is_active = 1 AND (
        p.item_code LIKE ? OR
        p.item_name LIKE ?
      )
      ORDER BY p.item_name ASC
      LIMIT 50
    `).all(searchTerm, searchTerm);
    return { success: true, products };
  }

  /**
   * Get a product by item code (used by scanner / quick lookup).
   */
  getByItemCode(itemCode) {
    const product = this.db.prepare(`
      SELECT p.*, c.name as category_name, sc.name as sub_category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN sub_categories sc ON p.sub_category_id = sc.id
      WHERE p.item_code = ? AND p.is_active = 1
    `).get(itemCode);
    if (!product) {
      return { success: false, error: 'Product not found.' };
    }
    return { success: true, product };
  }

  /**
   * Delete or deactivate a product.
   * If the product is referenced in invoices or sales returns, it is deactivated to preserve financial integrity.
   * Otherwise, it and its stock movements are permanently deleted.
   */
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
