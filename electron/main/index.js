const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { initializeDatabase, getDatabase, closeDatabase } = require('../../database/connection');
const { runMigrations } = require('../../database/migrations/runner');
const { registerIpcHandlers } = require('../ipc/handlers');

// Load environment variables from .env file if present
function loadEnv() {
  const candidatePaths = [
    path.join(__dirname, '..', '..', '.env'),
    path.join(process.cwd(), '.env'),
    process.resourcesPath ? path.join(process.resourcesPath, '.env') : null,
  ].filter(Boolean);

  for (const envPath of candidatePaths) {
    try {
      if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx !== -1) {
              const key = trimmed.slice(0, eqIdx).trim();
              const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
              if (key && !process.env[key]) {
                process.env[key] = val;
              }
            }
          }
        }
        console.log(`[Main] Loaded .env from: ${envPath}`);
        break;
      }
    } catch (envErr) {
      console.warn(`[Main] Could not read .env at ${envPath}:`, envErr);
    }
  }
}
loadEnv();

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'Buyra',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Load the app
  if (!app.isPackaged || process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'renderer', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    // Initialize SQLite database
    const dbPath = path.join(app.getPath('userData'), 'pos-database.sqlite');
    initializeDatabase(dbPath);

    // Run database migrations
    const db = getDatabase();
    runMigrations(db);

    // Device ID resolution for multi-terminal tracking
    const deviceIdPath = path.join(app.getPath('userData'), 'device-id.txt');
    let deviceId = 'POS-TERMINAL';
    try {
      if (fs.existsSync(deviceIdPath)) {
        deviceId = fs.readFileSync(deviceIdPath, 'utf8').trim();
      } else {
        const { v4: uuidv4 } = require('uuid');
        deviceId = `POS-${uuidv4().substring(0, 8).toUpperCase()}`;
        fs.writeFileSync(deviceIdPath, deviceId);
      }
    } catch (idErr) {
      console.warn('[Main] Device ID resolution warning:', idErr);
    }

    // Start background sync service (offline-first sync queue uploader)
    let syncService = null;
    try {
      const { SyncUploaderService } = require('../../sync/uploader/syncService');
      syncService = new SyncUploaderService(db, { deviceId });
      syncService.start();
    } catch (syncErr) {
      console.error('[Main] Sync service initialization error:', syncErr);
    }

    // Register IPC handlers
    registerIpcHandlers(ipcMain, syncService);

    // Create the main window
    createWindow();

    console.log('[Main] Application started successfully');
    console.log('[Main] Database path:', dbPath);
  } catch (error) {
    console.error('[Main] Failed to start application:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  closeDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Security: Prevent new windows
app.on('web-contents-created', (event, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});
