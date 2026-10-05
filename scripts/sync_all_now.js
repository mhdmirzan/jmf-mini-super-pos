const path = require('path');
const { getDatabase, initializeDatabase } = require('../database/connection');
const { SyncUploaderService } = require('../sync/uploader/syncService');

const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config');
const dbPath = path.join(appData, 'jmf-mini-super-pos', 'pos-database.sqlite');

initializeDatabase(dbPath);
const db = getDatabase();

// Reset failed items
const updated = db.prepare("UPDATE sync_queue SET status = 'PENDING', attempts = 0 WHERE status = 'FAILED'").run();
console.log(`Reset ${updated.changes} failed items back to PENDING`);

const sync = new SyncUploaderService(db);
console.log('Target API URL:', sync.getApiUrl());

sync.runSyncCycle().then(result => {
  console.log('Sync Result:', result);
  const remaining = db.prepare("SELECT status, count(*) as count FROM sync_queue GROUP BY status").all();
  console.log('Remaining queue counts:', remaining);
  const syncedInvoices = db.prepare("SELECT sync_status, count(*) as count FROM invoices GROUP BY sync_status").all();
  console.log('Invoices sync status:', syncedInvoices);
});
