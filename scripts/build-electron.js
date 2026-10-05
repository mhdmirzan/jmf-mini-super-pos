const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('[Build] Packaging Electron application with electron-builder...');
execSync('npx electron-builder --win nsis', { stdio: 'inherit' });

const tempOut = path.join(os.tmpdir(), 'minisuper-dist');
const projectOut = path.join(__dirname, '..', 'dist-electron');

if (!fs.existsSync(projectOut)) {
  fs.mkdirSync(projectOut, { recursive: true });
}

if (fs.existsSync(tempOut)) {
  const files = fs.readdirSync(tempOut);
  for (const file of files) {
    if (file.endsWith('.exe') || file.endsWith('.blockmap')) {
      const src = path.join(tempOut, file);
      const dest = path.join(projectOut, file);
      fs.copyFileSync(src, dest);
      console.log(`[Build] Output ready: ${file}`);
    }
  }
}
console.log('[Build] Done! Installer is available in dist-electron/');
