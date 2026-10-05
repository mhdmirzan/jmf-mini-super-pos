/**
 * Migration 002: Add unit column to products table for weight (KG) vs pieces (PCS).
 */
function up(db) {
  const pragma = db.prepare('PRAGMA table_info(products)').all();
  if (!pragma.some(c => c.name === 'unit')) {
    db.exec("ALTER TABLE products ADD COLUMN unit TEXT NOT NULL DEFAULT 'PCS';");
    console.log('[Migration] Added unit column to products table');
  }
  if (!pragma.some(c => c.name === 'wholesale_discount')) {
    db.exec("ALTER TABLE products ADD COLUMN wholesale_discount REAL NOT NULL DEFAULT 0;");
    console.log('[Migration] Added wholesale_discount column to products table');
  }
}

module.exports = { up };
