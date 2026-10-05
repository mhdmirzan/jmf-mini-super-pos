/**
 * Database Seed Script
 * Pre-populates the SQLite database with realistic supermarket categories,
 * sub-categories, and inventory products with barcodes and prices.
 */

const { v4: uuidv4 } = require('uuid');

function seedDatabase(db) {
  console.log('[Seed] Starting database seeding...');

  // Check if products already exist
  const existing = db.prepare('SELECT COUNT(*) as count FROM products').get();
  if (existing.count > 0) {
    console.log('[Seed] Products already exist, skipping seed');
    return;
  }

  const insertCategory = db.prepare(
    "INSERT OR IGNORE INTO categories (id, name, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))"
  );
  const insertSubCategory = db.prepare(
    "INSERT OR IGNORE INTO sub_categories (id, category_id, name, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))"
  );
  const insertProduct = db.prepare(`
    INSERT INTO products (
      id, item_code, barcode, category_id, sub_category_id, item_name, unit,
      quantity, minimum_quantity, cost, retail_price, retail_discount, wholesale_price,
      is_active, created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'), 1)
  `);
  const insertMovement = db.prepare(`
    INSERT INTO stock_movements (
      id, product_id, movement_type, quantity, reference_type, reference_id, reason, created_by, created_at
    ) VALUES (?, ?, 'PURCHASE', ?, 'SEED', ?, 'Initial stock seed', ?, datetime('now'))
  `);

  const runSeed = db.transaction(() => {
    // Find admin user for foreign key
    const admin = db.prepare("SELECT id FROM users WHERE username = 'admin' LIMIT 1").get();
    const adminId = admin ? admin.id : null;

    // 1. Categories & Subcategories
    const catBeverages = uuidv4();
    const catBakery = uuidv4();
    const catDairy = uuidv4();
    const catGrocery = uuidv4();
    const catHousehold = uuidv4();

    insertCategory.run(catBeverages, 'Beverages');
    insertCategory.run(catBakery, 'Bakery & Biscuits');
    insertCategory.run(catDairy, 'Dairy');
    insertCategory.run(catGrocery, 'Grocery Essentials');
    insertCategory.run(catHousehold, 'Household & Personal');

    const subSoftDrinks = uuidv4();
    const subWaterJuice = uuidv4();
    const subBread = uuidv4();
    const subBiscuits = uuidv4();
    const subMilk = uuidv4();
    const subRice = uuidv4();
    const subSoaps = uuidv4();

    insertSubCategory.run(subSoftDrinks, catBeverages, 'Carbonated Soft Drinks');
    insertSubCategory.run(subWaterJuice, catBeverages, 'Water & Fruit Juices');
    insertSubCategory.run(subBread, catBakery, 'Breads & Buns');
    insertSubCategory.run(subBiscuits, catBakery, 'Biscuits & Wafers');
    insertSubCategory.run(subMilk, catDairy, 'Milk & Butter');
    insertSubCategory.run(subRice, catGrocery, 'Rice & Flour');
    insertSubCategory.run(subSoaps, catHousehold, 'Soaps & Detergents');

    // 2. Realistic Supermarket Products
    const items = [
      {
        code: 'BEV-001',
        barcode: '4792011000012',
        cat: catBeverages,
        sub: subSoftDrinks,
        name: 'Coca Cola 500ml',
        qty: 48,
        min: 12,
        cost: 190.0,
        retail: 250.0,
        discount: 0,
        wholesale: 230.0,
      },
      {
        code: 'BEV-002',
        barcode: '4792011000029',
        cat: catBeverages,
        sub: subSoftDrinks,
        name: 'Sprite 500ml',
        qty: 36,
        min: 10,
        cost: 190.0,
        retail: 250.0,
        discount: 0,
        wholesale: 230.0,
      },
      {
        code: 'BEV-003',
        barcode: '4792011000036',
        cat: catBeverages,
        sub: subWaterJuice,
        name: 'Mineral Water 1.5L',
        qty: 60,
        min: 15,
        cost: 90.0,
        retail: 140.0,
        discount: 0,
        wholesale: 125.0,
      },
      {
        code: 'BAK-001',
        barcode: '4792011000043',
        cat: catBakery,
        sub: subBread,
        name: 'White Sandwich Bread 450g',
        qty: 24,
        min: 6,
        cost: 140.0,
        retail: 180.0,
        discount: 0,
        wholesale: 165.0,
      },
      {
        code: 'BAK-002',
        barcode: '4792011000050',
        cat: catBakery,
        sub: subBiscuits,
        name: 'Munchee Cream Cracker 200g',
        qty: 40,
        min: 8,
        cost: 110.0,
        retail: 150.0,
        discount: 10.0,
        wholesale: 135.0,
      },
      {
        code: 'DAI-001',
        barcode: '4792011000067',
        cat: catDairy,
        sub: subMilk,
        name: 'Anchor Milk Powder 400g',
        qty: 20,
        min: 5,
        cost: 980.0,
        retail: 1150.0,
        discount: 20.0,
        wholesale: 1100.0,
      },
      {
        code: 'DAI-002',
        barcode: '4792011000074',
        cat: catDairy,
        sub: subMilk,
        name: 'Highland Salted Butter 200g',
        qty: 15,
        min: 4,
        cost: 550.0,
        retail: 680.0,
        discount: 0,
        wholesale: 640.0,
      },
      {
        code: 'GRO-001',
        barcode: '4792011000081',
        cat: catGrocery,
        sub: subRice,
        name: 'Samba Premium Rice 5kg',
        unit: 'KG',
        qty: 25.0,
        min: 5.0,
        cost: 1200.0,
        retail: 1450.0,
        discount: 50.0,
        wholesale: 1380.0,
      },
      {
        code: 'HOU-001',
        barcode: '4792011000098',
        cat: catHousehold,
        sub: subSoaps,
        name: 'Sunlight Lemon Bar Soap 115g',
        qty: 60,
        min: 15,
        cost: 85.0,
        retail: 120.0,
        discount: 0,
        wholesale: 105.0,
      },
      {
        code: 'BEV-004',
        barcode: '4792011000104',
        cat: catBeverages,
        sub: subSoftDrinks,
        name: 'Elephant House Ginger Beer 400ml',
        qty: 3, // Low stock on purpose to test Low Stock alerts!
        min: 10,
        cost: 160.0,
        retail: 220.0,
        discount: 0,
        wholesale: 200.0,
      },
    ];

    for (const item of items) {
      const pid = uuidv4();
      insertProduct.run(
        pid,
        item.code,
        item.barcode,
        item.cat,
        item.sub,
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
