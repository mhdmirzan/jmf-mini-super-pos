/**
 * Sync Uploader Service
 * Background synchronization runner for the Electron main process.
 * 
 * Flow:
 * 1. Checks internet connectivity to Cloudflare Worker API.
 * 2. Fetches pending transactions from sync_queue.
 * 3. Builds complete transaction payloads (invoices with line items, returns).
 * 4. Dispatches POST /api/sync with device_id and batch payload.
 * 5. Marks successfully synced items as SYNCED in local SQLite.
 */

const { SyncQueueManager } = require('../queue/manager');

class SyncUploaderService {
  constructor(db, options = {}) {
    this.db = db;
    this.queueManager = new SyncQueueManager(db);
    this.apiUrl = options.apiUrl || process.env.CLOUD_API_URL || 'https://jmf-mini-super-pos-worker.jmfminisuper.workers.dev';
    this.deviceId = options.deviceId || 'POS-DEFAULT';
    this.syncIntervalMs = options.syncIntervalMs || 30000;
    this.timer = null;
    this.isRunning = false;
  }

  getApiUrl() {
    try {
      const dbUrl = this.db.prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'CLOUD_API_URL'").get()?.setting_value;
      if (dbUrl && dbUrl.trim()) return dbUrl.trim().replace(/\/+$/, '');
    } catch {}
    const envUrl = process.env.CLOUD_API_URL || this.apiUrl || 'https://jmf-mini-super-pos-worker.jmfminisuper.workers.dev';
    return envUrl.trim().replace(/\/+$/, '');
  }

  /**
   * Start periodic background sync worker
   */
  start() {
    if (this.timer) return;
    console.log(`[Sync] Background sync service started (Interval: ${this.syncIntervalMs / 1000}s)`);
    // Run immediately, then on interval
    this.pullCatalog();
    this.runSyncCycle();
    this.timer = setInterval(() => {
      this.syncCounter = (this.syncCounter || 0) + 1;
      if (this.syncCounter % 10 === 0) {
        this.pullCatalog();
      }
      this.runSyncCycle();
    }, this.syncIntervalMs);
  }

  /**
   * Pull active categories and products from central cloud database to keep catalog synced
   */
  async pullCatalog() {
    try {
      const targetUrl = this.getApiUrl();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      // 1. Fetch and merge categories
      try {
        const catRes = await fetch(`${targetUrl}/api/categories`, { signal: controller.signal });
        if (catRes.ok) {
          const catJson = await catRes.json();
          const catList = catJson.categories || catJson.data || [];
          if (catJson.success && Array.isArray(catList)) {
            const insertCat = this.db.prepare(`
              INSERT OR REPLACE INTO categories (id, name, created_at, updated_at)
              VALUES (?, ?, datetime('now'), datetime('now'))
            `);
            const insertSub = this.db.prepare(`
              INSERT OR REPLACE INTO sub_categories (id, category_id, name, created_at, updated_at)
              VALUES (?, ?, ?, datetime('now'), datetime('now'))
            `);
            this.db.transaction(() => {
              for (const cat of catList) {
                insertCat.run(cat.id, cat.name);
                if (Array.isArray(cat.sub_categories)) {
                  for (const sub of cat.sub_categories) {
                    insertSub.run(sub.id, cat.id, sub.name);
                  }
                }
              }
            })();
          }
        }
      } catch (catErr) {
        // category fetch non-fatal
      }

      // 2. Fetch and merge products
      const prodRes = await fetch(`${targetUrl}/api/products`, { signal: controller.signal });
      clearTimeout(timeout);

      if (prodRes.ok) {
        const prodJson = await prodRes.json();
        const prodList = prodJson.products || prodJson.data || [];
        if (prodJson.success && Array.isArray(prodList) && prodList.length > 0) {
          const upsertProd = this.db.prepare(`
            INSERT OR REPLACE INTO products (
              id, item_code, barcode, category_id, sub_category_id, item_name, unit,
              quantity, minimum_quantity, cost, retail_price, retail_discount,
              wholesale_price, wholesale_discount, is_active, created_at, updated_at, version
            ) VALUES (
              @id, @item_code, @barcode, @category_id, @sub_category_id, @item_name, @unit,
              @quantity, @minimum_quantity, @cost, @retail_price, @retail_discount,
              @wholesale_price, @wholesale_discount, @is_active, @created_at, @updated_at, @version
            )
          `);

          this.db.transaction(() => {
            for (const p of prodList) {
              upsertProd.run({
                id: p.id,
                item_code: p.item_code,
                barcode: p.barcode || null,
                category_id: p.category_id || null,
                sub_category_id: p.sub_category_id || null,
                item_name: p.item_name,
                unit: p.unit || 'PCS',
                quantity: p.quantity != null ? p.quantity : 0,
                minimum_quantity: p.minimum_quantity != null ? p.minimum_quantity : 0,
                cost: p.cost != null ? p.cost : 0,
                retail_price: p.retail_price != null ? p.retail_price : 0,
                retail_discount: p.retail_discount != null ? p.retail_discount : 0,
                wholesale_price: p.wholesale_price != null ? p.wholesale_price : 0,
                wholesale_discount: p.wholesale_discount != null ? p.wholesale_discount : 0,
                is_active: p.is_active != null ? p.is_active : 1,
                created_at: p.created_at || new Date().toISOString(),
                updated_at: p.updated_at || new Date().toISOString(),
                version: p.version || 1,
              });
            }
          })();
          console.log(`[Sync] Successfully pulled catalog (${prodList.length} products) from cloud`);
        }
      }
    } catch (err) {
      console.log('[Sync] Cloud catalog pull skipped (offline or server unreachable):', err.message);
    }
  }

  /**
   * Stop background sync
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[Sync] Background sync service stopped');
    }
  }

  /**
   * Run a single sync cycle
   */
  async runSyncCycle() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const pendingItems = this.queueManager.getPending(25);
      if (!pendingItems || pendingItems.length === 0) {
        this.isRunning = false;
        return { success: true, synced: 0 };
      }

      console.log(`[Sync] Found ${pendingItems.length} pending items to synchronize`);

      // Build batch payload
      const batch = [];
      const itemIds = [];

      for (const item of pendingItems) {
        itemIds.push(item.id);
        const payloadData = this._buildEntityPayload(item.entity_type, item.entity_id, item.operation);
        if (payloadData) {
          batch.push({
            queueId: item.id,
            entityType: item.entity_type,
            entityId: item.entity_id,
            operation: item.operation,
            data: payloadData,
          });
        }
      }

      if (batch.length === 0) {
        this.isRunning = false;
        return { success: true, synced: 0 };
      }

      // Mark items as SYNCING in SQLite
      this.queueManager.markSyncing(itemIds);

      // Attempt HTTP POST to Cloudflare Worker
      let uploadSuccess = false;
      let errorReason = null;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const targetUrl = this.getApiUrl();
        const response = await fetch(`${targetUrl}/api/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-ID': this.deviceId,
          },
          body: JSON.stringify({
            deviceId: this.deviceId,
            timestamp: new Date().toISOString(),
            batch,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) {
          const resJson = await response.json();
          if (resJson.success) {
            uploadSuccess = true;
          } else {
            errorReason = resJson.error || 'Server rejected batch';
          }
        } else {
          errorReason = `HTTP ${response.status}: ${response.statusText}`;
        }
      } catch (networkErr) {
        // Offline or connection timeout - expected behavior during internet outages
        errorReason = networkErr.message || 'Network unreachable';
      }

      // Update queue statuses in SQLite
      if (uploadSuccess) {
        for (const item of batch) {
          this.queueManager.markSynced(item.queueId);
          // If invoice, mark invoice.sync_status = 'SYNCED'
          if (item.entityType === 'INVOICE') {
            this.db.prepare("UPDATE invoices SET sync_status = 'SYNCED' WHERE id = ?").run(item.entityId);
          }
        }
        console.log(`[Sync] Successfully synchronized ${batch.length} items to cloud`);
      } else {
        for (const item of batch) {
          this.queueManager.markFailed(item.queueId, errorReason);
        }
        console.log(`[Sync] Batch remained queued (offline/error: ${errorReason})`);
      }

      return { success: uploadSuccess, count: batch.length, error: errorReason };
    } catch (err) {
      console.error('[Sync] Critical error in sync cycle:', err);
      return { success: false, error: err.message };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Helper: extract full entity data from local database
   */
  _buildEntityPayload(entityType, entityId, operation) {
    try {
      if (entityType === 'INVOICE') {
        const invoice = this.db.prepare('SELECT * FROM invoices WHERE id = ?').get(entityId);
        if (!invoice) return null;
        const items = this.db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(entityId);
        return { invoice, items };
      }

      if (entityType === 'SALES_RETURN') {
        const ret = this.db.prepare('SELECT * FROM sales_returns WHERE id = ?').get(entityId);
        if (!ret) return null;
        const items = this.db.prepare('SELECT * FROM sales_return_items WHERE return_id = ?').all(entityId);
        return { return: ret, items };
      }

      if (entityType === 'STOCK_MOVEMENT') {
        return this.db.prepare('SELECT * FROM stock_movements WHERE reference_id = ? OR id = ?').get(entityId, entityId);
      }

      return null;
    } catch (e) {
      console.error('[Sync] Error building entity payload:', e);
      return null;
    }
  }
}

module.exports = { SyncUploaderService };
