/**
 * Database Seed Script
 * Pre-populates the SQLite database with sample inventory products.
 */

const { v4: uuidv4 } = require('uuid');

function seedDatabase(db) {
  console.log('[Seed] Starting database seeding...');

  const existing = db.prepare('SELECT COUNT(*) as count FROM products').get();
  if (existing.count > 0) {
    console.log('[Seed] Products already exist, skipping seed');
    return;
  }

  const insertProduct = db.prepare(`
    INSERT INTO products (
      id, item_code, item_name, unit,
      quantity, minimum_quantity, cost, retail_price, retail_discount, wholesale_price,
      is_active, created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'), 1)
  `);
  const insertMovement = db.prepare(`
    INSERT INTO stock_movements (
      id, product_id, movement_type, quantity, reference_type, reference_id, reason, created_by, created_at
    ) VALUES (?, ?, 'PURCHASE', ?, 'SEED', ?, 'Initial stock seed', ?, datetime('now'))
  `);

  const runSeed = db.transaction(() => {
    const admin = db.prepare("SELECT id FROM users WHERE username = 'admin' LIMIT 1").get();
    const adminId = admin ? admin.id : null;

    const items = [
      { code: 'BEV-001', name: 'Coca Cola 500ml', qty: 48, min: 12, cost: 190.0, retail: 250.0, discount: 0, wholesale: 230.0 },
      { code: 'BEV-002', name: 'Sprite 500ml', qty: 36, min: 10, cost: 190.0, retail: 250.0, discount: 0, wholesale: 230.0 },
      { code: 'BEV-003', name: 'Mineral Water 1.5L', qty: 60, min: 15, cost: 90.0, retail: 140.0, discount: 0, wholesale: 125.0 },
      { code: 'BAK-001', name: 'White Sandwich Bread 450g', qty: 24, min: 6, cost: 140.0, retail: 180.0, discount: 0, wholesale: 165.0 },
      { code: 'BAK-002', name: 'Munchee Cream Cracker 200g', qty: 40, min: 8, cost: 110.0, retail: 150.0, discount: 10.0, wholesale: 135.0 },
      { code: 'DAI-001', name: 'Anchor Milk Powder 400g', qty: 20, min: 5, cost: 980.0, retail: 1150.0, discount: 20.0, wholesale: 1100.0 },
      { code: 'DAI-002', name: 'Highland Salted Butter 200g', qty: 15, min: 4, cost: 550.0, retail: 680.0, discount: 0, wholesale: 640.0 },
      { code: 'GRO-001', name: 'Samba Premium Rice 5kg', unit: 'KG', qty: 25.0, min: 5.0, cost: 1200.0, retail: 1450.0, discount: 50.0, wholesale: 1380.0 },
      { code: 'HOU-001', name: 'Sunlight Lemon Bar Soap 115g', qty: 60, min: 15, cost: 85.0, retail: 120.0, discount: 0, wholesale: 105.0 },
      { code: 'BEV-004', name: 'Elephant House Ginger Beer 400ml', qty: 3, min: 10, cost: 160.0, retail: 220.0, discount: 0, wholesale: 200.0 },
    ];

    for (const item of items) {
      const pid = uuidv4();
      insertProduct.run(
        pid,
        item.code,
        item.name,
        item.unit || 'PCS',
        item.qty,
        item.min,
        item.cost,
        item.retail,
        item.discount,
        item.wholesale
      );
      insertMovement.run(uuidv4(), pid, item.qty, pid, adminId);
    }
  });

  runSeed();
  console.log('[Seed] Seeding completed successfully (10 sample products added)');
}

module.exports = { seedDatabase };
