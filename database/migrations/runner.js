/**
 * Database migration runner.
 * Runs all migrations in order, tracking which have been applied.
 */

const migration001 = require('./001_initial_schema');
const migration002 = require('./002_add_unit_column');
const migration003 = require('./003_add_approval_requests');
const migration004 = require('./004_remove_barcode');

/**
 * Run all pending migrations.
 * Creates a migrations tracking table if it doesn't exist.
 */
function runMigrations(db) {
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = db.prepare('SELECT name FROM _migrations').all().map(r => r.name);

  const allMigrations = [
    { name: '001_initial_schema', up: migration001.up },
    { name: '002_add_unit_column', up: migration002.up },
    { name: '003_add_approval_requests', up: migration003.up },
    { name: '004_remove_barcode', up: migration004.up },
  ];

  const runMigration = db.transaction(() => {
    for (const migration of allMigrations) {
      if (!applied.includes(migration.name)) {
        console.log(`[Migration] Running: ${migration.name}`);
        migration.up(db);
        db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migration.name);
        console.log(`[Migration] Completed: ${migration.name}`);
      }
    }
  });

  runMigration();

  // Self-heal check: ensure expected product columns regardless of migration history
  try {
    const pragma = db.prepare('PRAGMA table_info(products)').all();
    if (pragma.length > 0) {
      if (!pragma.some(c => c.name === 'unit')) {
        db.exec("ALTER TABLE products ADD COLUMN unit TEXT NOT NULL DEFAULT 'PCS';");
        console.log('[Migration] Self-healed: Added missing unit column to products table');
      }
      if (!pragma.some(c => c.name === 'wholesale_discount')) {
        db.exec("ALTER TABLE products ADD COLUMN wholesale_discount REAL NOT NULL DEFAULT 0;");
        console.log('[Migration] Self-healed: Added missing wholesale_discount column to products table');
      }
      if (pragma.some(c => c.name === 'barcode')) {
        db.exec('DROP INDEX IF EXISTS idx_products_barcode');
        db.exec('ALTER TABLE products DROP COLUMN barcode');
        console.log('[Migration] Self-healed: Dropped barcode column from products table');
      }
    }
  } catch (err) {
    console.error('[Migration] Self-heal check error:', err);
  }

  console.log('[Migration] All migrations are up to date');
}

module.exports = { runMigrations };
