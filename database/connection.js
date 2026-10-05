const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db = null;

/**
 * Initialize the SQLite database connection.
 * Creates the database file and directory if they don't exist.
 * Enables WAL mode for better concurrent read/write performance.
 */
function initializeDatabase(dbPath) {
  try {
    // Ensure the directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(dbPath);

    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL');
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    // Busy timeout to handle concurrent access
    db.pragma('busy_timeout = 5000');

    console.log('[Database] Connected successfully to:', dbPath);
    return db;
  } catch (error) {
    console.error('[Database] Failed to initialize:', error);
    throw error;
  }
}

/**
 * Get the database instance.
 * Throws if not initialized.
 */
function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Close the database connection safely.
 */
function closeDatabase() {
  if (db) {
    try {
      db.close();
      console.log('[Database] Connection closed');
    } catch (error) {
      console.error('[Database] Error closing:', error);
    }
    db = null;
  }
}

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase,
};
