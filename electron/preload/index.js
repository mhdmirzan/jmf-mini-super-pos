const { contextBridge, ipcRenderer } = require('electron');

/**
 * Secure preload script.
 * Exposes a controlled API to the renderer via contextBridge.
 * Never expose ipcRenderer directly.
 */

// Allowed IPC channels for security
const VALID_CHANNELS = {
  invoke: [
    // Database
    'db:query',
    'db:run',
    'db:get',
    'db:all',
    // Auth
    'auth:login',
    'auth:logout',
    'auth:verify',
    'auth:getActiveUsers',
    // Users
    'users:create',
    'users:update',
    'users:list',
    'users:get',
    // Products
    'products:create',
    'products:update',
    'products:delete',
    'products:list',
    'products:get',
    'products:search',
    'products:getByItemCode',
    // Invoices
    'invoices:create',
    'invoices:cancel',
    'invoices:list',
    'invoices:get',
    // Sales Returns
    'returns:create',
    'returns:list',
    'returns:get',
    // Stock
    'stock:adjust',
    'stock:movements',
    // Settings
    'settings:get',
    'settings:set',
    // Sync
    'sync:status',
    'sync:trigger',
    // System
    'system:getDeviceId',
    'system:getDbStatus',
    // Printer
    'printer:list',
    'printer:printReceipt',
    // Audit
    'audit:list',
    // Approvals
    'approval:create',
    'approval:getPending',
    'approval:check',
    'approval:respond',
    'approval:verifyAdmin',
    // Bill item deletions
    'billDeletion:create',
    'billDeletion:list',
    'billDeletion:markAdminSeen',
    'billDeletion:countUnseenAdmin',
    // Reports
    'reports:dailySales',
    'reports:monthlySales',
    'reports:productSales',
    'reports:lowStock',
    'reports:stockValue',
  ],
  on: [
    'sync:update',
    'connection:status',
  ],
};

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Invoke an IPC handler and wait for the result
   */
  invoke: (channel, ...args) => {
    if (VALID_CHANNELS.invoke.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    throw new Error(`Invalid IPC channel: ${channel}`);
  },

  /**
   * Listen for events from the main process
   */
  on: (channel, callback) => {
    if (VALID_CHANNELS.on.includes(channel)) {
      const subscription = (_event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    }
    throw new Error(`Invalid IPC channel: ${channel}`);
  },
});
