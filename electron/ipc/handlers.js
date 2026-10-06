/**
 * IPC Handlers - Central registration of all IPC handlers.
 * Each handler communicates between the Electron main process and the renderer.
 */

const { getDatabase } = require('../../database/connection');
const { AuthRepository } = require('../../database/repositories/auth');
const { UserRepository } = require('../../database/repositories/users');
const { ProductRepository } = require('../../database/repositories/products');
const { CategoryRepository } = require('../../database/repositories/categories');
const { InvoiceRepository } = require('../../database/repositories/invoices');
const { ReturnsRepository } = require('../../database/repositories/returns');
const { StockRepository } = require('../../database/repositories/stock');
const { SettingsRepository } = require('../../database/repositories/settings');
const { AuditRepository } = require('../../database/repositories/audit');
const { ReportsRepository } = require('../../database/repositories/reports');
const { ApprovalRepository } = require('../../database/repositories/approvals');
const { v4: uuidv4 } = require('uuid');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

function registerIpcHandlers(ipcMain, syncService = null) {
  const db = getDatabase();
  const auth = new AuthRepository(db);
  const users = new UserRepository(db);
  const products = new ProductRepository(db);
  const categories = new CategoryRepository(db);
  const invoices = new InvoiceRepository(db);
  const returns = new ReturnsRepository(db);
  const stock = new StockRepository(db);
  const settings = new SettingsRepository(db);
  const audit = new AuditRepository(db);
  const reports = new ReportsRepository(db);
  const approvals = new ApprovalRepository(db);

  // ─── AUTH ───
  ipcMain.handle('auth:login', async (_event, { username, password }) => {
    try {
      return auth.login(username, password);
    } catch (error) {
      console.error('[IPC] auth:login error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('auth:verify', async (_event, { userId }) => {
    try {
      return auth.verify(userId);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('auth:getActiveUsers', async () => {
    try {
      return auth.getActiveUsers();
    } catch (error) {
      console.error('[IPC] auth:getActiveUsers error:', error);
      return { success: false, error: error.message };
    }
  });

  // ─── USERS ───
  ipcMain.handle('users:create', async (_event, data) => {
    try {
      return users.create(data);
    } catch (error) {
      console.error('[IPC] users:create error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('users:update', async (_event, data) => {
    try {
      return users.update(data);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('users:list', async (_event, requesterRole) => {
    try {
      return users.list(requesterRole);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('users:get', async (_event, { id }) => {
    try {
      return users.get(id);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ─── PRODUCTS ───
  ipcMain.handle('products:create', async (_event, data) => {
    try {
      return products.create(data);
    } catch (error) {
      console.error('[IPC] products:create error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('products:update', async (_event, data) => {
    try {
      return products.update(data);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('products:delete', async (_event, { id }) => {
    try {
      return products.delete(id);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('products:list', async (_event, filters) => {
    try {
      return products.list(filters);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('products:get', async (_event, { id }) => {
    try {
      return products.get(id);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('products:search', async (_event, { query }) => {
    try {
      return products.search(query);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('products:getByItemCode', async (_event, { itemCode }) => {
    try {
      return products.getByItemCode(itemCode);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ─── CATEGORIES ───
  ipcMain.handle('categories:create', async (_event, data) => {
    try {
      return categories.createCategory(data);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('categories:update', async (_event, data) => {
    try {
      return categories.updateCategory(data);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('categories:list', async () => {
    try {
      return categories.listCategories();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('subcategories:create', async (_event, data) => {
    try {
      return categories.createSubCategory(data);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('subcategories:update', async (_event, data) => {
    try {
      return categories.updateSubCategory(data);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('subcategories:list', async (_event, { categoryId } = {}) => {
    try {
      return categories.listSubCategories(categoryId);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ─── INVOICES ───
  ipcMain.handle('invoices:create', async (_event, data) => {
    try {
      const result = invoices.create(data);
      if (result.success && syncService) {
        syncService.runSyncCycle().catch((err) => {
          console.warn('[IPC] invoice sync trigger:', err?.message || err);
        });
      }
      return result;
    } catch (error) {
      console.error('[IPC] invoices:create error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('invoices:cancel', async (_event, data) => {
    try {
      return invoices.cancel(data);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('invoices:list', async (_event, filters) => {
    try {
      return invoices.list(filters);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('invoices:get', async (_event, { id }) => {
    try {
      return invoices.get(id);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ─── SALES RETURNS ───
  ipcMain.handle('returns:create', async (_event, data) => {
    try {
      return returns.create(data);
    } catch (error) {
      console.error('[IPC] returns:create error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('returns:list', async (_event, filters) => {
    try {
      return returns.list(filters);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('returns:get', async (_event, { id }) => {
    try {
      return returns.get(id);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ─── STOCK ───
  ipcMain.handle('stock:adjust', async (_event, data) => {
    try {
      const result = stock.adjust(data);
      if (result.success && syncService) {
        syncService.runSyncCycle().catch(() => {});
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('stock:movements', async (_event, filters) => {
    try {
      return stock.getMovements(filters);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ─── SETTINGS ───
  ipcMain.handle('settings:get', async (_event, { key } = {}) => {
    try {
      if (key) {
        return settings.get(key);
      }
      return settings.getAll();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:set', async (_event, data) => {
    try {
      return settings.set(data);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ─── SYSTEM ───
  ipcMain.handle('system:getDeviceId', async () => {
    try {
      const deviceIdPath = path.join(app.getPath('userData'), 'device-id.txt');
      let deviceId;
      if (fs.existsSync(deviceIdPath)) {
        deviceId = fs.readFileSync(deviceIdPath, 'utf-8').trim();
      } else {
        deviceId = `POS-${uuidv4().substring(0, 8).toUpperCase()}`;
        fs.writeFileSync(deviceIdPath, deviceId);
      }
      return { success: true, deviceId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('system:getDbStatus', async () => {
    try {
      const db = getDatabase();
      const tableCount = db.prepare(
        "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE '_migrations'"
      ).get();
      return { success: true, connected: true, tables: tableCount.count };
    } catch (error) {
      return { success: false, connected: false, error: error.message };
    }
  });

  // ─── AUDIT ───
  ipcMain.handle('audit:list', async (_event, filters) => {
    try {
      return audit.list(filters);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ─── REPORTS ───
  ipcMain.handle('reports:dailySales', async (_event, { date }) => {
    try {
      return reports.dailySales(date);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('reports:monthlySales', async (_event, { year, month }) => {
    try {
      return reports.monthlySales(year, month);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('reports:productSales', async (_event, filters) => {
    try {
      return reports.productSales(filters);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('reports:lowStock', async () => {
    try {
      return reports.lowStock();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('reports:stockValue', async () => {
    try {
      return reports.stockValue();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ─── SYNC ───
  ipcMain.handle('sync:status', async () => {
    try {
      const pending = db.prepare(
        "SELECT COUNT(*) as count FROM sync_queue WHERE status IN ('PENDING', 'FAILED')"
      ).get();
      return { 
        success: true, 
        pendingCount: pending ? pending.count : 0,
        apiUrl: syncService ? syncService.getApiUrl() : (process.env.CLOUD_API_URL || '')
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('sync:trigger', async () => {
    if (syncService) {
      try {
        const result = await syncService.runSyncCycle();
        return result;
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: 'Sync background service not initialized' };
  });

  // ─── APPROVALS (Wholesale Mode & Overrides) ───
  ipcMain.handle('approval:create', async (_event, payload) => {
    try {
      return approvals.create(payload);
    } catch (error) {
      console.error('[IPC] approval:create error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('approval:getPending', async () => {
    try {
      return approvals.getPending();
    } catch (error) {
      console.error('[IPC] approval:getPending error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('approval:check', async (_event, { requestId }) => {
    try {
      return approvals.checkStatus(requestId);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('approval:respond', async (_event, payload) => {
    try {
      return approvals.respond(payload);
    } catch (error) {
      console.error('[IPC] approval:respond error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('approval:verifyAdmin', async (_event, credentials) => {
    try {
      return approvals.verifyAdmin(credentials);
    } catch (error) {
      console.error('[IPC] approval:verifyAdmin error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('printer:list', async (event) => {
    try {
      const printers = await event.sender.getPrintersAsync();
      return { success: true, printers: printers || [] };
    } catch (error) {
      return { success: false, error: error.message, printers: [] };
    }
  });

  ipcMain.handle('printer:printReceipt', async (event, { html } = {}) => {
    try {
      const printers = await event.sender.getPrintersAsync();
      const connected = (printers || []).filter((p) => p && p.name);
      if (connected.length === 0) {
        return { success: false, error: 'No printer is connected' };
      }

      const thermalMatch = connected.find((p) => {
        const n = `${p.name} ${p.displayName || ''} ${p.description || ''}`.toLowerCase();
        return /pos|thermal|receipt|80mm|xp-|epson|star |citizen|bixolon|xprinter|rongta/.test(n);
      });
      const deviceName = (thermalMatch || connected.find((p) => p.isDefault) || connected[0]).name;

      const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    html, body {
      margin: 0;
      padding: 0;
      width: 80mm;
      background: #fff;
      color: #000;
      font-family: "Courier New", Courier, monospace;
      font-size: 12px;
      line-height: 1.25;
    }
    #printable-receipt { width: 72mm; margin: 0 auto; padding: 2mm; }
  </style>
</head>
<body>
  <div id="printable-receipt">${html || ''}</div>
</body>
</html>`;

      const { BrowserWindow } = require('electron');
      const printWin = new BrowserWindow({
        show: false,
        width: 302,
        height: 900,
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
        },
      });

      await printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(printHtml));
      await new Promise((resolve) => setTimeout(resolve, 250));

      const printed = await new Promise((resolve) => {
        printWin.webContents.print(
          {
            silent: true,
            printBackground: false,
            deviceName,
            margins: { marginType: 'none' },
            pagesPerSheet: 1,
            copies: 1,
            pageSize: {
              width: 80000,
              height: 297000,
            },
          },
          (success, failureReason) => {
            resolve({ success: !!success, error: failureReason || null });
          }
        );
      });

      try {
        if (!printWin.isDestroyed()) printWin.close();
      } catch {
        // ignore
      }

      if (!printed.success) {
        return {
          success: false,
          error: printed.error || 'Printer did not accept the job',
        };
      }
      return { success: true, printer: deviceName };
    } catch (error) {
      console.error('[IPC] printer:printReceipt error:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('[IPC] All handlers registered');
}

module.exports = { registerIpcHandlers };
