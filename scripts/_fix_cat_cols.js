const path = require('path');
const Database = require('better-sqlite3');
const { up } = require('../database/migrations/005_remove_categories');

const dbPath = path.join(process.env.APPDATA, 'jmf-mini-super-pos', 'pos-database.sqlite');
const db = new Database(dbPath);
up(db);
const cols = db.prepare('PRAGMA table_info(products)').all().map((c) => c.name);
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map((t) => t.name);
console.log('product cols:', cols.join(', '));
console.log('has category cols:', cols.includes('category_id') || cols.includes('sub_category_id'));
console.log('has categories table:', tables.includes('categories'));
const retCols = db.prepare('PRAGMA table_info(sales_return_items)').all().map((c) => c.name);
console.log('return item cols:', retCols.join(', '));
db.close();
