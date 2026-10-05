/**
 * Seed existing local SQLite database data into Cloudflare D1
 */
const path = require('path');
const fs = require('fs');
const { initializeDatabase, getDatabase } = require('../../database/connection');

const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config');
const dbPath = path.join(appData, 'jmf-mini-super-pos', 'pos-database.sqlite');

if (!fs.existsSync(dbPath)) {
  console.error('Local SQLite database not found at:', dbPath);
  process.exit(1);
}

initializeDatabase(dbPath);
const db = getDatabase();

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val;
  return `'${String(val).replace(/'/g, "''")}'`;
}

let sql = '-- Exported local data for Cloudflare D1\n\n';

// 1. Users
const users = db.prepare('SELECT * FROM users').all();
for (const u of users) {
  sql += `INSERT OR REPLACE INTO users (id, username, password_hash, full_name, role, is_active, created_by, created_at, updated_at, version) VALUES (${escapeSql(u.id)}, ${escapeSql(u.username)}, ${escapeSql(u.password_hash)}, ${escapeSql(u.full_name)}, ${escapeSql(u.role)}, ${u.is_active}, ${escapeSql(u.created_by)}, ${escapeSql(u.created_at)}, ${escapeSql(u.updated_at)}, ${u.version});\n`;
}

// 2. Categories
const categories = db.prepare('SELECT * FROM categories').all();
for (const c of categories) {
  sql += `INSERT OR REPLACE INTO categories (id, name, created_at, updated_at) VALUES (${escapeSql(c.id)}, ${escapeSql(c.name)}, ${escapeSql(c.created_at)}, ${escapeSql(c.updated_at)});\n`;
}

// 3. Sub Categories
const subCategories = db.prepare('SELECT * FROM sub_categories').all();
for (const sc of subCategories) {
  sql += `INSERT OR REPLACE INTO sub_categories (id, category_id, name, created_at, updated_at) VALUES (${escapeSql(sc.id)}, ${escapeSql(sc.category_id)}, ${escapeSql(sc.name)}, ${escapeSql(sc.created_at)}, ${escapeSql(sc.updated_at)});\n`;
}

// 4. Products
const products = db.prepare('SELECT * FROM products').all();
for (const p of products) {
  sql += `INSERT OR REPLACE INTO products (id, item_code, barcode, category_id, sub_category_id, item_name, unit, quantity, minimum_quantity, cost, retail_price, retail_discount, wholesale_price, is_active, created_at, updated_at, version) VALUES (${escapeSql(p.id)}, ${escapeSql(p.item_code)}, ${escapeSql(p.barcode)}, ${escapeSql(p.category_id)}, ${escapeSql(p.sub_category_id)}, ${escapeSql(p.item_name)}, ${escapeSql(p.unit || 'PCS')}, ${p.quantity}, ${p.minimum_quantity}, ${p.cost}, ${p.retail_price}, ${p.retail_discount}, ${escapeSql(p.wholesale_price)}, ${p.is_active}, ${escapeSql(p.created_at)}, ${escapeSql(p.updated_at)}, ${p.version});\n`;
}

// 5. System Settings
const settings = db.prepare('SELECT * FROM system_settings').all();
for (const s of settings) {
  sql += `INSERT OR REPLACE INTO system_settings (id, setting_key, setting_value, updated_at, updated_by) VALUES (${escapeSql(s.id)}, ${escapeSql(s.setting_key)}, ${escapeSql(s.setting_value)}, ${escapeSql(s.updated_at)}, ${escapeSql(s.updated_by)});\n`;
}

const outputPath = path.join(__dirname, 'seed_data.sql');
fs.writeFileSync(outputPath, sql, 'utf8');
console.log(`Generated ${outputPath} with ${users.length} users, ${categories.length} categories, ${subCategories.length} sub-categories, and ${products.length} products.`);
