/**
 * Categories Repository - CRUD for categories and sub-categories.
 */

const { v4: uuidv4 } = require('uuid');

class CategoryRepository {
  constructor(db) {
    this.db = db;
  }

  // ─── CATEGORIES ───

  createCategory({ name }) {
    const existing = this.db.prepare('SELECT id FROM categories WHERE name = ?').get(name);
    if (existing) {
      return { success: false, error: 'Category already exists.' };
    }

    const id = uuidv4();
    this.db.prepare(
      "INSERT INTO categories (id, name, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))"
    ).run(id, name);

    return { success: true, id };
  }

  updateCategory({ id, name }) {
    const category = this.db.prepare('SELECT id FROM categories WHERE id = ?').get(id);
    if (!category) {
      return { success: false, error: 'Category not found.' };
    }

    // Check uniqueness
    const existing = this.db.prepare('SELECT id FROM categories WHERE name = ? AND id != ?').get(name, id);
    if (existing) {
      return { success: false, error: 'Category name already exists.' };
    }

    this.db.prepare(
      "UPDATE categories SET name = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(name, id);

    return { success: true };
  }

  listCategories() {
    const categories = this.db.prepare(
      `SELECT c.*, 
        (SELECT COUNT(*) FROM products WHERE category_id = c.id) as product_count,
        (SELECT COUNT(*) FROM sub_categories WHERE category_id = c.id) as sub_category_count
       FROM categories c ORDER BY c.name ASC`
    ).all();
    return { success: true, categories };
  }

  // ─── SUB CATEGORIES ───

  createSubCategory({ categoryId, name }) {
    const category = this.db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId);
    if (!category) {
      return { success: false, error: 'Category not found.' };
    }

    const existing = this.db.prepare(
      'SELECT id FROM sub_categories WHERE category_id = ? AND name = ?'
    ).get(categoryId, name);
    if (existing) {
      return { success: false, error: 'Sub-category already exists in this category.' };
    }

    const id = uuidv4();
    this.db.prepare(
      "INSERT INTO sub_categories (id, category_id, name, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))"
    ).run(id, categoryId, name);

    return { success: true, id };
  }

  updateSubCategory({ id, name }) {
    const sub = this.db.prepare('SELECT * FROM sub_categories WHERE id = ?').get(id);
    if (!sub) {
      return { success: false, error: 'Sub-category not found.' };
    }

    const existing = this.db.prepare(
      'SELECT id FROM sub_categories WHERE category_id = ? AND name = ? AND id != ?'
    ).get(sub.category_id, name, id);
    if (existing) {
      return { success: false, error: 'Sub-category name already exists in this category.' };
    }

    this.db.prepare(
      "UPDATE sub_categories SET name = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(name, id);

    return { success: true };
  }

  listSubCategories(categoryId) {
    let query = 'SELECT sc.*, c.name as category_name FROM sub_categories sc LEFT JOIN categories c ON sc.category_id = c.id';
    const params = [];

    if (categoryId) {
      query += ' WHERE sc.category_id = ?';
      params.push(categoryId);
    }

    query += ' ORDER BY sc.name ASC';

    const subCategories = this.db.prepare(query).all(...params);
    return { success: true, subCategories };
  }
}

module.exports = { CategoryRepository };
