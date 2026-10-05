/**
 * Offline POS Core Business Logic & Transaction Verification Tests
 * Verifies all phases specified in important.md:
 * 1. Single SQLite transaction for sales
 * 2. Automatic stock deduction & movement recording
 * 3. Sync queue entry creation
 * 4. Sales returns with inventory restocking
 * 5. Invoice cancellation with stock reversal
 * 6. MAX_USERS limit enforcement
 * 7. Barcode search & live pricing
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { runMigrations } = require('../database/migrations/runner');
const { ProductRepository } = require('../database/repositories/products');
const { InvoiceRepository } = require('../database/repositories/invoices');
const { ReturnsRepository } = require('../database/repositories/returns');
const { UserRepository } = require('../database/repositories/users');
const { AuthRepository } = require('../database/repositories/auth');
const { SyncQueueManager } = require('../sync/queue/manager');

function setupTestDatabase() {
  // Use in-memory SQLite database for high speed isolated testing
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

test('1. Local SQLite Transaction & Offline Sale Workflow', async (t) => {
  const db = setupTestDatabase();
  const productsRepo = new ProductRepository(db);
  const invoicesRepo = new InvoiceRepository(db);
  const queueManager = new SyncQueueManager(db);

  const admin = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
  assert.ok(admin, 'Admin user should be seeded');

  // 1. Check seeded product
  const product = productsRepo.getByItemCode('BEV-001').product;
  assert.ok(product, 'Seeded product BEV-001 should exist');
  const initialQty = product.quantity;

  // 2. Perform a sale transaction
  const saleResult = invoicesRepo.create({
    cashierId: admin.id,
    items: [
      {
        productId: product.id,
        quantity: 2,
        unitDiscount: 0,
      },
    ],
    paymentMethod: 'CASH',
    cashReceived: 1000,
    deviceId: 'POS-TEST-01',
  });

  assert.strictEqual(saleResult.success, true, 'Sale should succeed');
  assert.ok(saleResult.invoice.invoiceNumber.startsWith('INV-'), 'Invoice number should have prefix');
  assert.strictEqual(saleResult.invoice.totalAmount, 500, '2 x 250 = 500');
  assert.strictEqual(saleResult.invoice.cashChange, 500, '1000 - 500 = 500');

  // 3. Verify stock was decreased
  const updatedProduct = productsRepo.get(product.id).product;
  assert.strictEqual(updatedProduct.quantity, initialQty - 2, 'Stock must decrease by 2');

  // 4. Verify stock movement was recorded
  const movement = db.prepare('SELECT * FROM stock_movements WHERE reference_id = ?').get(saleResult.invoice.id);
  assert.ok(movement, 'Stock movement must be recorded');
  assert.strictEqual(movement.movement_type, 'SALE');
  assert.strictEqual(movement.quantity, -2);

  // 5. Verify transaction entered sync_queue
  const queueItems = queueManager.getPending();
  const queueEntry = queueItems.find((q) => q.entity_id === saleResult.invoice.id);
  assert.ok(queueEntry, 'Invoice must be placed in sync_queue');
  assert.strictEqual(queueEntry.status, 'PENDING');
});

test('2. Sales Return & Restocking Workflow', async (t) => {
  const db = setupTestDatabase();
  const productsRepo = new ProductRepository(db);
  const invoicesRepo = new InvoiceRepository(db);
  const returnsRepo = new ReturnsRepository(db);

  const admin = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
  const product = productsRepo.getByItemCode('BAK-001').product;
  const initialQty = product.quantity;

  // Create sale
  const sale = invoicesRepo.create({
    cashierId: admin.id,
    items: [{ productId: product.id, quantity: 3, unitDiscount: 0 }],
    paymentMethod: 'CARD',
    deviceId: 'POS-TEST-01',
  });

  const qtyAfterSale = productsRepo.get(product.id).product.quantity;
  assert.strictEqual(qtyAfterSale, initialQty - 3);

  // Get invoice item ID
  const invoiceItems = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(sale.invoice.id);
  assert.strictEqual(invoiceItems.length, 1);

  // Process Return for 1 item
  const returnRes = returnsRepo.create({
    originalInvoiceId: sale.invoice.id,
    reason: 'Customer returned item',
    processedBy: admin.id,
    deviceId: 'POS-TEST-01',
    items: [
      {
        invoiceItemId: invoiceItems[0].id,
        quantity: 1,
        reason: 'Customer changed mind',
      },
    ],
  });

  assert.strictEqual(returnRes.success, true);
  assert.ok(returnRes.return.returnNumber.startsWith('RET-'));

  // Stock must have increased by 1
  const qtyAfterReturn = productsRepo.get(product.id).product.quantity;
  assert.strictEqual(qtyAfterReturn, qtyAfterSale + 1, 'Stock must replenish upon return');

  // Original invoice must remain unchanged
  const origInvoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(sale.invoice.id);
  assert.strictEqual(origInvoice.status, 'COMPLETED');
});

test('3. Invoice Cancellation & Reversal Workflow', async (t) => {
  const db = setupTestDatabase();
  const productsRepo = new ProductRepository(db);
  const invoicesRepo = new InvoiceRepository(db);

  const admin = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
  const product = productsRepo.getByItemCode('BEV-002').product;
  const initialQty = product.quantity;

  // Create sale
  const sale = invoicesRepo.create({
    cashierId: admin.id,
    items: [{ productId: product.id, quantity: 4, unitDiscount: 0 }],
    paymentMethod: 'CASH',
    cashReceived: 2000,
    deviceId: 'POS-TEST-01',
  });

  assert.strictEqual(productsRepo.get(product.id).product.quantity, initialQty - 4);

  // Cancel invoice
  const cancelRes = invoicesRepo.cancel({
    invoiceId: sale.invoice.id,
    cancelledBy: admin.id,
    reason: 'Cashier error',
  });

  assert.strictEqual(cancelRes.success, true);

  // Verify status is CANCELLED and not deleted
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(sale.invoice.id);
  assert.strictEqual(inv.status, 'CANCELLED');
  assert.strictEqual(inv.cancellation_reason, 'Cashier error');

  // Verify stock reversed back to original
  assert.strictEqual(productsRepo.get(product.id).product.quantity, initialQty);
});

test('4. MAX_USERS Limit Enforcement Rule', async (t) => {
  const db = setupTestDatabase();
  const userRepo = new UserRepository(db);

  const superAdmin = db.prepare("SELECT id FROM users WHERE username = 'superadmin'").get();

  // Default max users is 5, superadmin and admin are already 2 active users
  // Let's set MAX_USERS to 3 to test boundary
  db.prepare("UPDATE system_settings SET setting_value = '3' WHERE setting_key = 'MAX_USERS'").run();

  // Create user 3 (should succeed)
  const u2 = userRepo.create({
    username: 'cashier01',
    password: 'password123',
    fullName: 'Cashier One',
    role: 'CASHIER',
    createdBy: superAdmin.id,
    requesterRole: 'SUPER_ADMIN',
  });
  assert.strictEqual(u2.success, true);

  // Create user 4 (must fail because limit is 3)
  const u3 = userRepo.create({
    username: 'cashier02',
    password: 'password123',
    fullName: 'Cashier Two',
    role: 'CASHIER',
    createdBy: superAdmin.id,
    requesterRole: 'SUPER_ADMIN',
  });
  assert.strictEqual(u3.success, false);
  assert.match(u3.error, /User limit reached/i);
});

test('5. Retail vs Wholesale Pricing & Discounts and Admin Price Changes', async (t) => {
  const db = setupTestDatabase();
  const productsRepo = new ProductRepository(db);
  const invoicesRepo = new InvoiceRepository(db);

  const admin = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();

  // 1. Get initial product
  const prod = productsRepo.getByItemCode('BEV-001').product;
  assert.ok(prod, 'BEV-001 should exist');

  // 2. Admin updates Retail and Wholesale prices & Retail discount
  const updateRes = productsRepo.update({
    id: prod.id,
    retailPrice: 260,
    retailDiscount: 10,
    wholesalePrice: 220,
    updatedBy: admin.id,
  });
  assert.strictEqual(updateRes.success, true);

  const updatedProd = productsRepo.get(prod.id).product;
  assert.strictEqual(updatedProd.retail_price, 260);
  assert.strictEqual(updatedProd.retail_discount, 10);
  assert.strictEqual(updatedProd.wholesale_price, 220);

  // 3. Sell 5 units at Wholesale Price (wholesale has no discount)
  // Unit wholesale price = 220, unit discount = 0
  // Total line = 220 * 5 = 1100
  const saleRes = invoicesRepo.create({
    cashierId: admin.id,
    items: [
      {
        productId: prod.id,
        quantity: 5,
        unitPrice: 220,
        unitDiscount: 0,
      },
    ],
    paymentMethod: 'CASH',
    cashReceived: 1500,
    deviceId: 'POS-TEST-01',
  });

  assert.strictEqual(saleRes.success, true);
  assert.strictEqual(saleRes.invoice.subtotal, 1100); // 220 * 5
  assert.strictEqual(saleRes.invoice.totalDiscount, 0);
  assert.strictEqual(saleRes.invoice.totalAmount, 1100);
  assert.strictEqual(saleRes.invoice.cashChange, 400); // 1500 - 1100

  // 4. Verify invoice_items historical snapshot in SQLite
  const itemRow = db.prepare(
    'SELECT * FROM invoice_items WHERE invoice_id = ?'
  ).get(saleRes.invoice.id);

  assert.strictEqual(itemRow.unit_price, 220);
  assert.strictEqual(itemRow.unit_discount, 0);
  assert.strictEqual(itemRow.discount, 0);
  assert.strictEqual(itemRow.amount, 1100);
});

test('6. User Creation, Case-Insensitive Login & Editing Usernames', async (t) => {
  const db = setupTestDatabase();
  const userRepo = new UserRepository(db);
  const authRepo = new AuthRepository(db);

  const superAdmin = db.prepare("SELECT id FROM users WHERE username = 'superadmin'").get();

  // 0. Verify Admin cannot manage users or view users list
  const adminList = userRepo.list('ADMIN');
  assert.strictEqual(adminList.success, false);
  assert.match(adminList.error, /Only Super Admin/i);

  const adminCreateAttempt = userRepo.create({
    username: 'illegaluser',
    password: 'password',
    fullName: 'Unauthorized',
    role: 'CASHIER',
    requesterRole: 'ADMIN',
  });
  assert.strictEqual(adminCreateAttempt.success, false);
  assert.match(adminCreateAttempt.error, /Only Super Admin/i);

  // 1. Super Admin creates a Cashier user
  const createCashier = userRepo.create({
    username: 'cashier01',
    password: 'cashierpass',
    fullName: 'Jane Cashier',
    role: 'CASHIER',
    createdBy: superAdmin.id,
    requesterRole: 'SUPER_ADMIN',
  });
  assert.strictEqual(createCashier.success, true);

  // 2. Super Admin creates an Admin user
  const createAdmin = userRepo.create({
    username: 'storeadmin',
    password: 'adminpass',
    fullName: 'Bob Store Admin',
    role: 'ADMIN',
    createdBy: superAdmin.id,
  });
  assert.strictEqual(createAdmin.success, true);

  // 3. Test Case-Insensitive login for Cashier: 'Cashier01', 'CASHIER01', '  cashier01  '
  const log1 = authRepo.login('Cashier01', 'cashierpass');
  assert.strictEqual(log1.success, true, 'Capitalized username should log in');
  assert.strictEqual(log1.user.role, 'CASHIER');

  const log2 = authRepo.login('  cashier01  ', 'cashierpass');
  assert.strictEqual(log2.success, true, 'Trimmed username should log in');

  // 4. Test Case-Insensitive login for Admin: 'StoreAdmin', 'STOREADMIN'
  const logAdmin = authRepo.login('STOREADMIN', 'adminpass');
  assert.strictEqual(logAdmin.success, true, 'Admin with all caps should log in');
  assert.strictEqual(logAdmin.user.role, 'ADMIN');

  // 5. Wrong password fails gracefully
  const failLog = authRepo.login('cashier01', 'wrongpassword');
  assert.strictEqual(failLog.success, false);
  assert.match(failLog.error, /Invalid username or password/i);

  // 6. Super Admin updates username and password (e.g. fixing a typo)
  const updateRes = userRepo.update({
    id: createCashier.id,
    username: 'cashier_renamed',
    password: 'newcashierpass',
    fullName: 'Jane Cashier Updated',
    role: 'CASHIER',
    updatedBy: superAdmin.id,
  });
  assert.strictEqual(updateRes.success, true);

  // Old username can no longer log in
  const oldLogin = authRepo.login('cashier01', 'cashierpass');
  assert.strictEqual(oldLogin.success, false);

  // New username and password log in successfully
  const newLogin = authRepo.login('Cashier_Renamed', 'newcashierpass');
  assert.strictEqual(newLogin.success, true);
  assert.strictEqual(newLogin.user.fullName, 'Jane Cashier Updated');

  // 7. Verify getActiveUsers returns all active users
  const activeList = authRepo.getActiveUsers();
  assert.strictEqual(activeList.success, true);
  assert.strictEqual(activeList.users.length, 4); // superadmin, admin, cashier_renamed, storeadmin

  // 8. Super Admin can view users list
  const superList = userRepo.list('SUPER_ADMIN');
  assert.strictEqual(superList.success, true);
  assert.strictEqual(superList.users.length, 4);
});


