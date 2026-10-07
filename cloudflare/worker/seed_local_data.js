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

const users = db.prepare('SELECT * FROM users').all();
for (const u of users) {
  sql += `INSERT OR REPLACE INTO users (id, username, password_hash, full_name, role, is_active, created_by, created_at, updated_at, version) VALUES (${escapeSql(u.id)}, ${escapeSql(u.username)}, ${escapeSql(u.password_hash)}, ${escapeSql(u.full_name)}, ${escapeSql(u.role)}, ${u.is_active}, ${escapeSql(u.created_by)}, ${escapeSql(u.created_at)}, ${escapeSql(u.updated_at)}, ${u.version});\n`;
}

const products = db.prepare('SELECT * FROM products').all();
for (const p of products) {
  sql += `INSERT OR REPLACE INTO products (id, item_code, item_name, unit, quantity, minimum_quantity, cost, retail_price, retail_discount, wholesale_price, is_active, created_at, updated_at, version) VALUES (${escapeSql(p.id)}, ${escapeSql(p.item_code)}, ${escapeSql(p.item_name)}, ${escapeSql(p.unit || 'PCS')}, ${p.quantity}, ${p.minimum_quantity}, ${p.cost}, ${p.retail_price}, ${p.retail_discount}, ${escapeSql(p.wholesale_price)}, ${p.is_active}, ${escapeSql(p.created_at)}, ${escapeSql(p.updated_at)}, ${p.version});\n`;
}

const settings = db.prepare('SELECT * FROM system_settings').all();
for (const s of settings) {
  sql += `INSERT OR REPLACE INTO system_settings (id, setting_key, setting_value, updated_at, updated_by) VALUES (${escapeSql(s.id)}, ${escapeSql(s.setting_key)}, ${escapeSql(s.setting_value)}, ${escapeSql(s.updated_at)}, ${escapeSql(s.updated_by)});\n`;
}

const outputPath = path.join(__dirname, 'seed_data.sql');
fs.writeFileSync(outputPath, sql, 'utf8');
console.log(`Generated ${outputPath} with ${users.length} users and ${products.length} products.`);
