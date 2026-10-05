import bcrypt from 'bcryptjs';

/**
 * Cloudflare Worker REST API & Synchronization Gateway
 * Backed by Cloudflare D1 (SQLite at the edge).
 * 
 * Provides:
 * - Direct REST API for web browsers (Cloudflare Pages web app)
 * - POST /api/sync: Idempotent multi-terminal batch sync for Electron desktop app
 * - Role-based authorization & data validation
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    // CORS preflight
    if (method === 'OPTIONS') {
      return handleCors();
    }

    try {
      // 1. Health & Status
      if (path === '/api/health' && method === 'GET') {
        return jsonResponse({ status: 'ok', time: new Date().toISOString() });
      }

      // 2. PRIMARY SYNC ENDPOINT (Desktop Terminals)
      if (path === '/api/sync' && method === 'POST') {
        return handleSync(request, env);
      }

      // 3. AUTH API
      if (path === '/api/auth/login' && method === 'POST') {
        return handleLogin(request, env);
      }
      if (path === '/api/auth/verify' && method === 'POST') {
        return handleVerify(request, env);
      }

      // 4. USERS API
      if (path === '/api/users') {
        if (method === 'GET') return getUsers(request, env);
        if (method === 'POST') return createUser(request, env);
      }
      if (path.startsWith('/api/users/') && method === 'GET') {
        const id = path.replace('/api/users/', '');
        return getUser(id, env);
      }
      if (path.startsWith('/api/users/') && method === 'PUT') {
        const id = path.replace('/api/users/', '');
        return updateUser(id, request, env);
      }

      // 5. PRODUCTS API
      if (path === '/api/products') {
        if (method === 'GET') return getProducts(request, env);
        if (method === 'POST') return createProduct(request, env);
      }
      if (path === '/api/products/search' && method === 'GET') {
        return searchProducts(request, env);
      }
      if (path.startsWith('/api/products/barcode/') && method === 'GET') {
        const barcode = decodeURIComponent(path.replace('/api/products/barcode/', ''));
        return getProductByBarcode(barcode, env);
      }
      if (path.startsWith('/api/products/code/') && method === 'GET') {
        const code = decodeURIComponent(path.replace('/api/products/code/', ''));
        return getProductByItemCode(code, env);
      }
      if (path.startsWith('/api/products/') && method === 'GET') {
        const id = path.replace('/api/products/', '');
        return getProduct(id, env);
      }
      if (path.startsWith('/api/products/') && method === 'PUT') {
        const id = path.replace('/api/products/', '');
        return updateProduct(id, request, env);
      }
      if (path.startsWith('/api/products/') && method === 'DELETE') {
        const id = path.replace('/api/products/', '');
        return deleteProduct(id, env);
      }

      // 6. CATEGORIES & SUB-CATEGORIES API
      if (path === '/api/categories') {
        if (method === 'GET') return getCategories(env);
        if (method === 'POST') return createCategory(request, env);
      }
      if (path.startsWith('/api/categories/') && method === 'PUT') {
        const id = path.replace('/api/categories/', '');
        return updateCategory(id, request, env);
      }
      if (path === '/api/subcategories') {
        if (method === 'GET') return getSubCategories(request, env);
        if (method === 'POST') return createSubCategory(request, env);
      }
      if (path.startsWith('/api/subcategories/') && method === 'PUT') {
        const id = path.replace('/api/subcategories/', '');
        return updateSubCategory(id, request, env);
      }

      // 7. INVOICES API
      if (path === '/api/invoices') {
        if (method === 'GET') return getInvoices(request, env);
        if (method === 'POST') return createInvoice(request, env);
      }
      if (path.match(/^\/api\/invoices\/[^/]+\/cancel$/) && method === 'POST') {
        const id = path.split('/')[3];
        return cancelInvoice(id, request, env);
      }
      if (path.startsWith('/api/invoices/') && method === 'GET') {
        const id = path.replace('/api/invoices/', '');
        return getInvoice(id, env);
      }

      // 8. RETURNS API
      if (path === '/api/returns') {
        if (method === 'GET') return getReturns(request, env);
        if (method === 'POST') return createReturn(request, env);
      }
      if (path.startsWith('/api/returns/') && method === 'GET') {
        const id = path.replace('/api/returns/', '');
        return getReturn(id, env);
      }

      // 9. STOCK API
      if (path === '/api/stock/adjust' && method === 'POST') {
        return adjustStock(request, env);
      }
      if (path === '/api/stock/movements' && method === 'GET') {
        return getStockMovements(request, env);
      }

      // 10. SETTINGS API
      if (path === '/api/settings') {
        if (method === 'GET') return getSettings(request, env);
        if (method === 'POST') return setSetting(request, env);
      }

      // 11. REPORTS API
      if (path === '/api/reports/daily' && method === 'GET') {
        return getDailyReport(request, env);
      }
      if (path === '/api/reports/monthly' && method === 'GET') {
        return getMonthlyReport(request, env);
      }
      if (path === '/api/reports/top-products' && method === 'GET') {
        return getTopProductsReport(request, env);
      }
      if (path === '/api/reports/cashiers' && method === 'GET') {
        return getCashierSummaryReport(request, env);
      }
      if (path === '/api/reports/stock-value' && method === 'GET') {
        return getStockValueReport(env);
      }

      // 12. APPROVALS API
      if (path === '/api/approvals') {
        if (method === 'GET') return getPendingApprovals(request, env);
        if (method === 'POST') return createApprovalRequest(request, env);
      }
      if (path === '/api/approvals/verify-admin' && method === 'POST') {
        return verifyAdminApproval(request, env);
      }
      if (path.startsWith('/api/approvals/') && method === 'GET') {
        const id = path.replace('/api/approvals/', '');
        return getApprovalRequest(id, env);
      }
      if (path.startsWith('/api/approvals/') && method === 'PUT') {
        const id = path.replace('/api/approvals/', '');
        return respondApprovalRequest(id, request, env);
      }

      return jsonResponse({ error: 'Endpoint not found' }, 404);
    } catch (err) {
      console.error('[Worker Error]', err);
      return jsonResponse({ error: err.message || 'Internal server error' }, 500);
    }
  },
};

// ─── AUTH HANDLERS ───
async function handleLogin(request, env) {
  const { username, password } = await request.json();
  if (!username || !password) {
    return jsonResponse({ success: false, error: 'Please enter both username and password.' }, 400);
  }

  const cleanUsername = String(username).trim();
  const user = await env.DB.prepare(
    'SELECT id, username, password_hash, full_name, role, is_active FROM users WHERE LOWER(TRIM(username)) = LOWER(TRIM(?))'
  ).bind(cleanUsername).first();

  if (!user) {
    return jsonResponse({ success: false, error: 'Invalid username or password.' }, 401);
  }

  if (!user.is_active) {
    return jsonResponse({ success: false, error: 'Account is disabled. Please contact the administrator.' }, 403);
  }

  const isValid = bcrypt.compareSync(String(password), user.password_hash);
  if (!isValid) {
    return jsonResponse({ success: false, error: 'Invalid username or password.' }, 401);
  }

  return jsonResponse({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: (user.role || 'CASHIER').toUpperCase().trim(),
    },
  });
}

async function handleVerify(request, env) {
  const { userId } = await request.json();
  if (!userId) return jsonResponse({ success: false, error: 'User ID is required' }, 400);

  const user = await env.DB.prepare(
    'SELECT id, username, full_name, role, is_active FROM users WHERE id = ? AND is_active = 1'
  ).bind(userId).first();

  if (!user) {
    return jsonResponse({ success: false, error: 'Session expired or user disabled.' }, 401);
  }

  return jsonResponse({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
    },
  });
}

// ─── USERS HANDLERS ───
async function getUsers(request, env) {
  const url = new URL(request.url);
  const activeOnly = url.searchParams.get('activeOnly') === 'true';

  let query = 'SELECT id, username, full_name, role, is_active, created_at FROM users';
  if (activeOnly) {
    query += ' WHERE is_active = 1';
  }
  query += ' ORDER BY full_name ASC';

  const result = await env.DB.prepare(query).all();
  return jsonResponse({ success: true, users: result.results });
}

async function getUser(id, env) {
  const user = await env.DB.prepare('SELECT id, username, full_name, role, is_active, created_at FROM users WHERE id = ?').bind(id).first();
  if (!user) return jsonResponse({ success: false, error: 'User not found' }, 404);
  return jsonResponse({ success: true, user });
}

async function createUser(request, env) {
  const { username, password, fullName, role, createdBy } = await request.json();
  if (!username || !password || !fullName || !role) {
    return jsonResponse({ success: false, error: 'All fields are required.' }, 400);
  }

  // Check MAX_USERS rule
  const countRow = await env.DB.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').first();
  const maxSetting = await env.DB.prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'MAX_USERS'").first();
  const maxUsers = maxSetting ? parseInt(maxSetting.setting_value, 10) : 5;

  if (countRow.count >= maxUsers) {
    return jsonResponse({ success: false, error: `Maximum user limit (${maxUsers}) reached.` }, 400);
  }

  // Check unique username
  const existing = await env.DB.prepare('SELECT id FROM users WHERE LOWER(TRIM(username)) = LOWER(TRIM(?))').bind(username).first();
  if (existing) {
    return jsonResponse({ success: false, error: 'Username already exists.' }, 400);
  }

  const id = crypto.randomUUID();
  const passwordHash = bcrypt.hashSync(password, 10);

  await env.DB.prepare(`
    INSERT INTO users (id, username, password_hash, full_name, role, is_active, created_by, created_at, updated_at, version)
    VALUES (?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'), 1)
  `).bind(id, username.trim(), passwordHash, fullName.trim(), role, createdBy || null).run();

  return jsonResponse({ success: true, id });
}

async function updateUser(id, request, env) {
  const { fullName, role, isActive, password } = await request.json();

  if (password && String(password).trim()) {
    const passwordHash = bcrypt.hashSync(password, 10);
    await env.DB.prepare(`
      UPDATE users SET
        full_name = COALESCE(?, full_name),
        role = COALESCE(?, role),
        is_active = COALESCE(?, is_active),
        password_hash = ?,
        updated_at = datetime('now'),
        version = version + 1
      WHERE id = ?
    `).bind(fullName || null, role || null, isActive !== undefined ? (isActive ? 1 : 0) : null, passwordHash, id).run();
  } else {
    await env.DB.prepare(`
      UPDATE users SET
        full_name = COALESCE(?, full_name),
        role = COALESCE(?, role),
        is_active = COALESCE(?, is_active),
        updated_at = datetime('now'),
        version = version + 1
      WHERE id = ?
    `).bind(fullName || null, role || null, isActive !== undefined ? (isActive ? 1 : 0) : null, id).run();
  }

  return jsonResponse({ success: true });
}

// ─── PRODUCTS HANDLERS ───
async function getProducts(request, env) {
  const url = new URL(request.url);
  const isActive = url.searchParams.get('isActive');
  const categoryId = url.searchParams.get('categoryId');
  const subCategoryId = url.searchParams.get('subCategoryId');
  const search = url.searchParams.get('search');
  const lowStock = url.searchParams.get('lowStock') === 'true';

  let query = `
    SELECT p.*, c.name as category_name, sc.name as sub_category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN sub_categories sc ON p.sub_category_id = sc.id
  `;
  const conditions = [];
  const params = [];

  if (isActive !== null && isActive !== undefined) {
    conditions.push('p.is_active = ?');
    params.push(isActive === 'true' || isActive === '1' ? 1 : 0);
  }
  if (categoryId) {
    conditions.push('p.category_id = ?');
    params.push(categoryId);
  }
  if (subCategoryId) {
    conditions.push('p.sub_category_id = ?');
    params.push(subCategoryId);
  }
  if (search && search.trim()) {
    conditions.push('(p.barcode LIKE ? OR p.item_code LIKE ? OR p.item_name LIKE ?)');
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }
  if (lowStock) {
    conditions.push('p.quantity <= p.minimum_quantity');
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY p.item_name ASC';

  const result = params.length > 0
    ? await env.DB.prepare(query).bind(...params).all()
    : await env.DB.prepare(query).all();

  return jsonResponse({ success: true, products: result.results });
}

async function getProduct(id, env) {
  const product = await env.DB.prepare(`
    SELECT p.*, c.name as category_name, sc.name as sub_category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN sub_categories sc ON p.sub_category_id = sc.id
    WHERE p.id = ?
  `).bind(id).first();

  if (!product) return jsonResponse({ success: false, error: 'Product not found' }, 404);
  return jsonResponse({ success: true, product });
}

async function searchProducts(request, env) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  if (!q.trim()) return jsonResponse({ success: true, products: [] });

  const term = `%${q.trim()}%`;
  const result = await env.DB.prepare(`
    SELECT p.*, c.name as category_name, sc.name as sub_category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN sub_categories sc ON p.sub_category_id = sc.id
    WHERE p.is_active = 1 AND (
      p.barcode LIKE ? OR
      p.item_code LIKE ? OR
      p.item_name LIKE ?
    )
    ORDER BY p.item_name ASC
    LIMIT 50
  `).bind(term, term, term).all();

  return jsonResponse({ success: true, products: result.results });
}

async function getProductByBarcode(barcode, env) {
  const product = await env.DB.prepare(`
    SELECT p.*, c.name as category_name, sc.name as sub_category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN sub_categories sc ON p.sub_category_id = sc.id
    WHERE p.barcode = ? AND p.is_active = 1
  `).bind(barcode).first();

  if (!product) return jsonResponse({ success: false, error: 'Product not found' }, 404);
  return jsonResponse({ success: true, product });
}

async function getProductByItemCode(code, env) {
  const product = await env.DB.prepare(`
    SELECT p.*, c.name as category_name, sc.name as sub_category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN sub_categories sc ON p.sub_category_id = sc.id
    WHERE p.item_code = ? AND p.is_active = 1
  `).bind(code).first();

  if (!product) return jsonResponse({ success: false, error: 'Product not found' }, 404);
  return jsonResponse({ success: true, product });
}

async function createProduct(request, env) {
  const data = await request.json();
  const id = crypto.randomUUID();
  const unit = String(data.unit || 'PCS').toUpperCase() === 'KG' ? 'KG' : 'PCS';

  await env.DB.prepare(`
    INSERT INTO products (
      id, item_code, barcode, category_id, sub_category_id, item_name,
      unit, quantity, minimum_quantity, cost, retail_price, retail_discount, wholesale_price,
      is_active, created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'), 1)
  `).bind(
    id, data.itemCode, data.barcode || null, data.categoryId || null, data.subCategoryId || null,
    data.itemName, unit, data.quantity || 0, data.minimumQuantity || 0, data.cost || 0,
    data.retailPrice || 0, data.retailDiscount || 0, data.wholesalePrice || 0
  ).run();

  return jsonResponse({ success: true, id });
}

async function updateProduct(id, request, env) {
  const data = await request.json();
  const unit = data.unit ? (String(data.unit).toUpperCase() === 'KG' ? 'KG' : 'PCS') : null;

  await env.DB.prepare(`
    UPDATE products SET
      item_name = COALESCE(?, item_name),
      unit = COALESCE(?, unit),
      minimum_quantity = COALESCE(?, minimum_quantity),
      cost = COALESCE(?, cost),
      retail_price = COALESCE(?, retail_price),
      retail_discount = COALESCE(?, retail_discount),
      wholesale_price = COALESCE(?, wholesale_price),
      is_active = COALESCE(?, is_active),
      version = version + 1,
      updated_at = datetime('now')
    WHERE id = ?
  `).bind(
    data.itemName || null, unit, data.minimumQuantity !== undefined ? data.minimumQuantity : null,
    data.cost !== undefined ? data.cost : null, data.retailPrice !== undefined ? data.retailPrice : null,
    data.retailDiscount !== undefined ? data.retailDiscount : null,
    data.wholesalePrice !== undefined ? data.wholesalePrice : null,
    data.isActive !== undefined ? (data.isActive ? 1 : 0) : null,
    id
  ).run();

  return jsonResponse({ success: true });
}

async function deleteProduct(id, env) {
  // Check if referenced in invoices
  const invMatch = await env.DB.prepare('SELECT id FROM invoice_items WHERE product_id = ? LIMIT 1').bind(id).first();
  const retMatch = await env.DB.prepare('SELECT id FROM sales_return_items WHERE product_id = ? LIMIT 1').bind(id).first();

  if (invMatch || retMatch) {
    await env.DB.prepare("UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ?").bind(id).run();
    return jsonResponse({ success: true, message: 'Product archived (preserved for sales history).' });
  }

  await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
  return jsonResponse({ success: true });
}

// ─── CATEGORIES & SUBCATEGORIES ───
async function getCategories(env) {
  const result = await env.DB.prepare('SELECT * FROM categories ORDER BY name ASC').all();
  return jsonResponse({ success: true, categories: result.results });
}

async function createCategory(request, env) {
  const { name } = await request.json();
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO categories (id, name) VALUES (?, ?)').bind(id, name).run();
  return jsonResponse({ success: true, id });
}

async function updateCategory(id, request, env) {
  const { name } = await request.json();
  await env.DB.prepare("UPDATE categories SET name = ?, updated_at = datetime('now') WHERE id = ?").bind(name, id).run();
  return jsonResponse({ success: true });
}

async function getSubCategories(request, env) {
  const url = new URL(request.url);
  const categoryId = url.searchParams.get('categoryId');
  let query = 'SELECT * FROM sub_categories';
  const params = [];
  if (categoryId) {
    query += ' WHERE category_id = ?';
    params.push(categoryId);
  }
  query += ' ORDER BY name ASC';
  const result = params.length > 0
    ? await env.DB.prepare(query).bind(...params).all()
    : await env.DB.prepare(query).all();
  return jsonResponse({ success: true, subCategories: result.results });
}

async function createSubCategory(request, env) {
  const { categoryId, name } = await request.json();
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO sub_categories (id, category_id, name) VALUES (?, ?, ?)').bind(id, categoryId, name).run();
  return jsonResponse({ success: true, id });
}

async function updateSubCategory(id, request, env) {
  const { name } = await request.json();
  await env.DB.prepare("UPDATE sub_categories SET name = ?, updated_at = datetime('now') WHERE id = ?").bind(name, id).run();
  return jsonResponse({ success: true });
}

// ─── INVOICES HANDLERS ───
async function getInvoices(request, env) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const date = url.searchParams.get('date');

  let query = `
    SELECT i.*, u.full_name as cashier_name
    FROM invoices i
    LEFT JOIN users u ON i.cashier_id = u.id
  `;
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push('i.status = ?');
    params.push(status);
  }
  if (date) {
    conditions.push("date(i.created_at) = date(?)");
    params.push(date);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY i.created_at DESC LIMIT 150';

  const result = params.length > 0
    ? await env.DB.prepare(query).bind(...params).all()
    : await env.DB.prepare(query).all();

  return jsonResponse({ success: true, invoices: result.results });
}

async function getInvoice(id, env) {
  const invoice = await env.DB.prepare(`
    SELECT i.*, u.full_name as cashier_name
    FROM invoices i
    LEFT JOIN users u ON i.cashier_id = u.id
    WHERE i.id = ?
  `).bind(id).first();

  if (!invoice) return jsonResponse({ success: false, error: 'Invoice not found' }, 404);

  const items = await env.DB.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').bind(id).all();
  return jsonResponse({ success: true, invoice: { ...invoice, items: items.results } });
}

async function createInvoice(request, env) {
  const { cashierId, items, paymentMethod, cashReceived, deviceId } = await request.json();

  if (!items || items.length === 0) {
    return jsonResponse({ success: false, error: 'Invoice must contain at least one item.' }, 400);
  }

  // Generate Invoice Number
  const prefixSetting = await env.DB.prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'INVOICE_PREFIX'").first();
  const pre = prefixSetting ? prefixSetting.setting_value : 'INV';
  const lastInv = await env.DB.prepare('SELECT invoice_number FROM invoices ORDER BY created_at DESC LIMIT 1').first();
  let nextNum = 1;
  if (lastInv && lastInv.invoice_number) {
    const match = lastInv.invoice_number.match(/(\d+)$/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  const invoiceNumber = `${pre}-${String(nextNum).padStart(6, '0')}`;
  const invoiceId = crypto.randomUUID();

  let subtotal = 0;
  let totalDiscount = 0;
  const statements = [];
  const processedItems = [];

  for (const it of items) {
    const product = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(it.productId).first();
    if (!product) return jsonResponse({ success: false, error: `Product not found: ${it.productId}` }, 400);

    const unitPrice = Number(it.unitPrice !== undefined ? it.unitPrice : product.retail_price);
    const unitDiscount = Number(it.unitDiscount !== undefined ? it.unitDiscount : (product.retail_discount || 0));
    const discount = Math.round(unitDiscount * it.quantity * 100) / 100;
    const amount = Math.round(((unitPrice * it.quantity) - discount) * 100) / 100;

    subtotal = Math.round((subtotal + (unitPrice * it.quantity)) * 100) / 100;
    totalDiscount = Math.round((totalDiscount + discount) * 100) / 100;

    const itemId = crypto.randomUUID();
    statements.push(
      env.DB.prepare(`
        INSERT INTO invoice_items (
          id, invoice_id, product_id, item_code, item_name, unit_price, quantity, unit_discount, discount, amount, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(itemId, invoiceId, product.id, product.item_code, product.item_name, unitPrice, it.quantity, unitDiscount, discount, amount)
    );

    statements.push(
      env.DB.prepare("UPDATE products SET quantity = quantity - ?, updated_at = datetime('now') WHERE id = ?").bind(it.quantity, product.id)
    );

    statements.push(
      env.DB.prepare(`
        INSERT INTO stock_movements (id, product_id, movement_type, quantity, reference_type, reference_id, reason, created_by, created_at)
        VALUES (?, ?, 'SALE', ?, 'INVOICE', ?, 'Sale completed', ?, datetime('now'))
      `).bind(crypto.randomUUID(), product.id, -it.quantity, invoiceId, cashierId || 'WEB')
    );

    processedItems.push({
      id: itemId,
      productId: product.id,
      itemCode: product.item_code,
      itemName: product.item_name,
      unitPrice,
      quantity: it.quantity,
      unitDiscount,
      discount,
      amount,
    });
  }

  const totalAmount = Math.max(0, Math.round((subtotal - totalDiscount) * 100) / 100);
  const numCash = parseFloat(cashReceived) || null;
  const cashChange = (paymentMethod === 'CASH' && numCash && numCash >= totalAmount) ? Math.round((numCash - totalAmount) * 100) / 100 : 0;

  statements.unshift(
    env.DB.prepare(`
      INSERT INTO invoices (
        id, invoice_number, cashier_id, subtotal, total_discount, total_amount, payment_method, cash_received, cash_change, status, device_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, datetime('now'), datetime('now'))
    `).bind(invoiceId, invoiceNumber, cashierId || 'WEB', subtotal, totalDiscount, totalAmount, paymentMethod, numCash, cashChange, deviceId || 'WEB')
  );

  await env.DB.batch(statements);

  return jsonResponse({
    success: true,
    invoice: {
      id: invoiceId,
      invoiceNumber,
      cashierId,
      subtotal,
      totalDiscount,
      totalAmount,
      paymentMethod,
      cashReceived: numCash,
      cashChange,
      items: processedItems,
    },
  });
}

async function cancelInvoice(id, request, env) {
  const { reason, cancelledBy } = await request.json();

  const invoice = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(id).first();
  if (!invoice) return jsonResponse({ success: false, error: 'Invoice not found' }, 404);
  if (invoice.status === 'CANCELLED') return jsonResponse({ success: false, error: 'Invoice is already cancelled' }, 400);

  const items = await env.DB.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').bind(id).all();
  const statements = [];

  statements.push(
    env.DB.prepare(`
      UPDATE invoices SET status = 'CANCELLED', cancelled_by = ?, cancellation_reason = ?, cancelled_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).bind(cancelledBy || null, reason || null, id)
  );

  for (const it of items.results) {
    statements.push(
      env.DB.prepare("UPDATE products SET quantity = quantity + ?, updated_at = datetime('now') WHERE id = ?").bind(it.quantity, it.product_id)
    );
    statements.push(
      env.DB.prepare(`
        INSERT INTO stock_movements (id, product_id, movement_type, quantity, reference_type, reference_id, reason, created_by, created_at)
        VALUES (?, ?, 'RETURN', ?, 'INVOICE_CANCEL', ?, 'Invoice Cancelled Restock', ?, datetime('now'))
      `).bind(crypto.randomUUID(), it.product_id, it.quantity, id, cancelledBy || 'WEB')
    );
  }

  await env.DB.batch(statements);
  return jsonResponse({ success: true });
}

// ─── RETURNS HANDLERS ───
async function getReturns(request, env) {
  const result = await env.DB.prepare(`
    SELECT r.*, u.full_name as processed_by_name, i.invoice_number
    FROM sales_returns r
    LEFT JOIN users u ON r.processed_by = u.id
    LEFT JOIN invoices i ON r.original_invoice_id = i.id
    ORDER BY r.created_at DESC LIMIT 100
  `).all();
  return jsonResponse({ success: true, returns: result.results });
}

async function getReturn(id, env) {
  const ret = await env.DB.prepare('SELECT * FROM sales_returns WHERE id = ?').bind(id).first();
  if (!ret) return jsonResponse({ success: false, error: 'Return not found' }, 404);
  const items = await env.DB.prepare('SELECT * FROM sales_return_items WHERE return_id = ?').bind(id).all();
  return jsonResponse({ success: true, return: { ...ret, items: items.results } });
}

async function createReturn(request, env) {
  const { originalInvoiceId, reason, processedBy, items } = await request.json();
  if (!items || items.length === 0) return jsonResponse({ success: false, error: 'At least one return item required.' }, 400);

  const prefixSetting = await env.DB.prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'INVOICE_PREFIX'").first();
  const pre = prefixSetting ? prefixSetting.setting_value : 'INV';
  const lastRet = await env.DB.prepare('SELECT return_number FROM sales_returns ORDER BY created_at DESC LIMIT 1').first();
  let nextNum = 1;
  if (lastRet && lastRet.return_number) {
    const match = lastRet.return_number.match(/(\d+)$/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  const returnNumber = `RET-${String(nextNum).padStart(6, '0')}`;
  const returnId = crypto.randomUUID();

  const statements = [];
  statements.push(
    env.DB.prepare(`
      INSERT INTO sales_returns (id, return_number, original_invoice_id, reason, processed_by, device_id, created_at)
      VALUES (?, ?, ?, ?, ?, 'WEB', datetime('now'))
    `).bind(returnId, returnNumber, originalInvoiceId, reason || 'Return', processedBy || 'WEB')
  );

  for (const it of items) {
    statements.push(
      env.DB.prepare(`
        INSERT INTO sales_return_items (id, return_id, invoice_item_id, product_id, item_code, item_name, sales_price, quantity, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(crypto.randomUUID(), returnId, it.invoiceItemId, it.productId, it.itemCode, it.itemName, it.salesPrice || 0, it.quantity, it.reason || '')
    );
    statements.push(
      env.DB.prepare("UPDATE products SET quantity = quantity + ?, updated_at = datetime('now') WHERE id = ?").bind(it.quantity, it.productId)
    );
    statements.push(
      env.DB.prepare(`
        INSERT INTO stock_movements (id, product_id, movement_type, quantity, reference_type, reference_id, reason, created_by, created_at)
        VALUES (?, ?, 'RETURN', ?, 'RETURN', ?, ?, ?, datetime('now'))
      `).bind(crypto.randomUUID(), it.productId, it.quantity, returnId, reason || 'Sales Return', processedBy || 'WEB')
    );
  }

  await env.DB.batch(statements);
  return jsonResponse({ success: true, returnNumber, id: returnId });
}

// ─── STOCK HANDLERS ───
async function adjustStock(request, env) {
  const { productId, newQuantity, reason, adjustedBy } = await request.json();
  const product = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(productId).first();
  if (!product) return jsonResponse({ success: false, error: 'Product not found' }, 404);

  const diff = Number(newQuantity) - product.quantity;
  const statements = [
    env.DB.prepare("UPDATE products SET quantity = ?, updated_at = datetime('now') WHERE id = ?").bind(newQuantity, productId),
    env.DB.prepare(`
      INSERT INTO stock_movements (id, product_id, movement_type, quantity, reference_type, reference_id, reason, created_by, created_at)
      VALUES (?, ?, 'ADJUSTMENT', ?, 'MANUAL', ?, ?, ?, datetime('now'))
    `).bind(crypto.randomUUID(), productId, diff, productId, reason || 'Manual adjustment', adjustedBy || 'WEB'),
  ];

  await env.DB.batch(statements);
  return jsonResponse({ success: true });
}

async function getStockMovements(request, env) {
  const url = new URL(request.url);
  const productId = url.searchParams.get('productId');
  let query = `
    SELECT sm.*, p.item_name, p.item_code
    FROM stock_movements sm
    LEFT JOIN products p ON sm.product_id = p.id
  `;
  const params = [];
  if (productId) {
    query += ' WHERE sm.product_id = ?';
    params.push(productId);
  }
  query += ' ORDER BY sm.created_at DESC LIMIT 100';

  const result = params.length > 0
    ? await env.DB.prepare(query).bind(...params).all()
    : await env.DB.prepare(query).all();

  return jsonResponse({ success: true, movements: result.results });
}

// ─── SETTINGS HANDLERS ───
async function getSettings(request, env) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  if (key) {
    const setting = await env.DB.prepare('SELECT setting_value FROM system_settings WHERE setting_key = ?').bind(key).first();
    return jsonResponse({ success: true, value: setting ? setting.setting_value : null });
  }

  const all = await env.DB.prepare('SELECT setting_key, setting_value FROM system_settings').all();
  const settings = {};
  for (const s of all.results) {
    settings[s.setting_key] = s.setting_value;
  }
  return jsonResponse({ success: true, settings });
}

async function setSetting(request, env) {
  const { key, value, updatedBy } = await request.json();
  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO system_settings (id, setting_key, setting_value, updated_at, updated_by)
    VALUES (?, ?, ?, datetime('now'), ?)
    ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = datetime('now'), updated_by = excluded.updated_by
  `).bind(id, key, String(value), updatedBy || 'WEB').run();
  return jsonResponse({ success: true });
}

// ─── REPORTS HANDLERS ───
async function getDailyReport(request, env) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);

  const stats = await env.DB.prepare(`
    SELECT
      COUNT(*) as totalInvoices,
      COALESCE(SUM(total_amount), 0) as grossSales,
      COALESCE(SUM(total_discount), 0) as totalDiscount,
      COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN total_amount ELSE 0 END), 0) as cashSales,
      COALESCE(SUM(CASE WHEN payment_method = 'CARD' THEN total_amount ELSE 0 END), 0) as cardSales
    FROM invoices
    WHERE date(created_at) = date(?) AND status = 'COMPLETED'
  `).bind(date).first();

  return jsonResponse({ success: true, report: stats });
}

async function getMonthlyReport(request, env) {
  const url = new URL(request.url);
  const ym = url.searchParams.get('yearMonth') || new Date().toISOString().slice(0, 7);

  const stats = await env.DB.prepare(`
    SELECT
      COUNT(*) as totalInvoices,
      COALESCE(SUM(total_amount), 0) as grossSales,
      COALESCE(SUM(total_discount), 0) as totalDiscount,
      COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN total_amount ELSE 0 END), 0) as cashSales,
      COALESCE(SUM(CASE WHEN payment_method = 'CARD' THEN total_amount ELSE 0 END), 0) as cardSales
    FROM invoices
    WHERE strftime('%Y-%m', created_at) = ? AND status = 'COMPLETED'
  `).bind(ym).first();

  return jsonResponse({ success: true, report: stats });
}

async function getTopProductsReport(request, env) {
  const result = await env.DB.prepare(`
    SELECT
      ii.product_id,
      ii.item_code,
      ii.item_name,
      SUM(ii.quantity) as totalQuantity,
      SUM(ii.amount) as totalRevenue
    FROM invoice_items ii
    JOIN invoices i ON ii.invoice_id = i.id
    WHERE i.status = 'COMPLETED'
    GROUP BY ii.product_id
    ORDER BY totalRevenue DESC
    LIMIT 10
  `).all();

  return jsonResponse({ success: true, topProducts: result.results });
}

async function getCashierSummaryReport(request, env) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);

  const result = await env.DB.prepare(`
    SELECT
      u.id as cashier_id,
      u.full_name as cashier_name,
      COUNT(i.id) as invoice_count,
      COALESCE(SUM(i.total_amount), 0) as total_sales
    FROM users u
    LEFT JOIN invoices i ON u.id = i.cashier_id AND date(i.created_at) = date(?) AND i.status = 'COMPLETED'
    GROUP BY u.id
    ORDER BY total_sales DESC
  `).bind(date).all();

  return jsonResponse({ success: true, summary: result.results });
}

async function getStockValueReport(env) {
  const result = await env.DB.prepare(`
    SELECT
      COUNT(*) as totalItems,
      COALESCE(SUM(quantity * retail_price), 0) as totalRetailValue,
      COALESCE(SUM(quantity * cost), 0) as totalCostValue
    FROM products
    WHERE is_active = 1
  `).first();

  return jsonResponse({ success: true, ...result });
}

// ─── BATCH SYNC HANDLER (Desktop Offline Terminals) ───
async function handleSync(request, env) {
  const body = await request.json();
  const { deviceId, batch } = body;

  if (!deviceId || !Array.isArray(batch)) {
    return jsonResponse({ error: 'Invalid sync payload' }, 400);
  }

  // Update device active status
  await env.DB.prepare(`
    INSERT INTO devices (id, device_id, device_name, last_sync_at, is_active, created_at)
    VALUES (?, ?, ?, datetime('now'), 1, datetime('now'))
    ON CONFLICT(device_id) DO UPDATE SET last_sync_at = datetime('now')
  `).bind(crypto.randomUUID(), deviceId, deviceId).run();

  let processedCount = 0;
  const statements = [];

  for (const item of batch) {
    const { entityType, entityId, operation, data } = item;

    // A. SYNC INVOICE
    if (entityType === 'INVOICE') {
      const { invoice, items } = data;
      if (!invoice) continue;

      statements.push(
        env.DB.prepare(`
          INSERT OR IGNORE INTO invoices (
            id, invoice_number, cashier_id, subtotal, total_discount, total_amount,
            payment_method, cash_received, cash_change, status, device_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          invoice.id, invoice.invoice_number, invoice.cashier_id, invoice.subtotal,
          invoice.total_discount, invoice.total_amount, invoice.payment_method,
          invoice.cash_received, invoice.cash_change, invoice.status,
          deviceId, invoice.created_at, invoice.updated_at
        )
      );

      if (Array.isArray(items)) {
        for (const it of items) {
          statements.push(
            env.DB.prepare(`
              INSERT OR IGNORE INTO invoice_items (
                id, invoice_id, product_id, item_code, item_name, unit_price, quantity,
                unit_discount, discount, amount, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              it.id, invoice.id, it.product_id, it.item_code, it.item_name,
              it.unit_price, it.quantity, it.unit_discount, it.discount, it.amount, it.created_at
            )
          );

          statements.push(
            env.DB.prepare(
              "UPDATE products SET quantity = quantity - ?, updated_at = datetime('now') WHERE id = ?"
            ).bind(it.quantity, it.product_id)
          );
        }
      }
      processedCount++;
    }

    // B. SYNC SALES RETURN
    if (entityType === 'SALES_RETURN') {
      const { return: ret, items } = data;
      if (!ret) continue;

      statements.push(
        env.DB.prepare(`
          INSERT OR IGNORE INTO sales_returns (
            id, return_number, original_invoice_id, reason, processed_by, device_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          ret.id, ret.return_number, ret.original_invoice_id,
          ret.reason, ret.processed_by, deviceId, ret.created_at
        )
      );

      if (Array.isArray(items)) {
        for (const it of items) {
          statements.push(
            env.DB.prepare(`
              INSERT OR IGNORE INTO sales_return_items (
                id, return_id, invoice_item_id, product_id, item_code, item_name,
                category_id, sales_price, quantity, reason, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              it.id, ret.id, it.invoice_item_id, it.product_id, it.item_code, it.item_name,
              it.category_id, it.sales_price, it.quantity, it.reason, it.created_at
            )
          );

          statements.push(
            env.DB.prepare(
              "UPDATE products SET quantity = quantity + ?, updated_at = datetime('now') WHERE id = ?"
            ).bind(it.quantity, it.product_id)
          );
        }
      }
      processedCount++;
    }

    // C. SYNC STOCK MOVEMENT
    if (entityType === 'STOCK_MOVEMENT') {
      const movement = data;
      if (movement) {
        statements.push(
          env.DB.prepare(`
            INSERT OR IGNORE INTO stock_movements (
              id, product_id, movement_type, quantity, reference_type, reference_id, reason, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            movement.id, movement.product_id, movement.movement_type, movement.quantity,
            movement.reference_type, movement.reference_id, movement.reason, movement.created_by, movement.created_at
          )
        );
      }
      processedCount++;
    }
  }

  if (statements.length > 0) {
    await env.DB.batch(statements);
  }

  return jsonResponse({
    success: true,
    processed: processedCount,
    syncedAt: new Date().toISOString(),
  });
}

// ─── APPROVALS HANDLERS (Wholesale Mode & Overrides) ───
async function ensureApprovalTable(env) {
  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS approval_requests (
        id TEXT PRIMARY KEY,
        request_type TEXT NOT NULL DEFAULT 'WHOLESALE_MODE',
        cashier_id TEXT,
        cashier_name TEXT,
        device_id TEXT,
        details TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        approved_by TEXT,
        approved_by_name TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();
  } catch {}
}

async function createApprovalRequest(request, env) {
  try {
    await ensureApprovalTable(env);
    const body = await request.json().catch(() => ({}));
    const id = body.id || crypto.randomUUID();
    const { requestType = 'WHOLESALE_MODE', cashierId, cashierName, deviceId, details = '' } = body;

    await env.DB.prepare(`
      INSERT OR REPLACE INTO approval_requests (
        id, request_type, cashier_id, cashier_name, device_id, details, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', datetime('now'), datetime('now'))
    `).bind(id, requestType, cashierId || null, cashierName || 'Cashier', deviceId || 'WEB', details).run();

    return jsonResponse({ success: true, requestId: id });
  } catch (err) {
    console.error('[createApprovalRequest error]', err);
    return jsonResponse({ success: false, error: err.message, stack: err.stack }, 500);
  }
}

async function getPendingApprovals(request, env) {
  await ensureApprovalTable(env);
  const result = await env.DB.prepare(`
    SELECT * FROM approval_requests
    WHERE status = 'PENDING'
    ORDER BY created_at DESC
    LIMIT 20
  `).all();

  return jsonResponse({ success: true, requests: result.results || [] });
}

async function getApprovalRequest(id, env) {
  await ensureApprovalTable(env);
  const req = await env.DB.prepare('SELECT * FROM approval_requests WHERE id = ?').bind(id).first();
  if (!req) return jsonResponse({ success: false, error: 'Request not found' }, 404);
  return jsonResponse({ success: true, request: req });
}

async function respondApprovalRequest(id, request, env) {
  await ensureApprovalTable(env);
  const body = await request.json();
  const { status, approvedBy, approvedByName, requestType = 'WHOLESALE_BILL', cashierId = null, cashierName = 'Cashier', details = '' } = body;

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return jsonResponse({ success: false, error: 'Invalid status' }, 400);
  }

  const result = await env.DB.prepare(`
    UPDATE approval_requests
    SET status = ?, approved_by = ?, approved_by_name = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(status, approvedBy || null, approvedByName || null, id).run();

  if (result.meta?.changes === 0) {
    await env.DB.prepare(`
      INSERT OR REPLACE INTO approval_requests (
        id, request_type, cashier_id, cashier_name, device_id, details, status, approved_by, approved_by_name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'REMOTE', ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(id, requestType, cashierId, cashierName, details, status, approvedBy || null, approvedByName || null).run();
  }

  return jsonResponse({ success: true, status });
}

async function verifyAdminApproval(request, env) {
  const { username, password } = await request.json();
  if (!username || !password) {
    return jsonResponse({ success: false, error: 'Username and password required' }, 400);
  }

  const user = await env.DB.prepare(`
    SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND is_active = 1
  `).bind(username.trim()).first();

  if (!user) {
    return jsonResponse({ success: false, error: 'User not found or inactive' }, 401);
  }

  const role = (user.role || '').toUpperCase();
  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
    return jsonResponse({ success: false, error: 'Only Admin or Super Admin can approve wholesale mode' }, 403);
  }

  const isValid = bcrypt.compareSync(password, user.password_hash);
  if (!isValid) {
    return jsonResponse({ success: false, error: 'Invalid password' }, 401);
  }

  return jsonResponse({
    success: true,
    approver: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
    }
  });
}

// ─── HELPER FUNCTIONS ───
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-ID',
    },
  });
}

function handleCors() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-ID',
    },
  });
}
