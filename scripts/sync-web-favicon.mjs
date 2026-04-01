/**
 * Mirrors build/icon.png → public/favicon.png so the web shell (index.html)
 * uses the same primary asset as Electron + electron-builder. No-op if missing.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'build', 'icon.png');
const dst = path.join(root, 'public', 'favicon.png');

if (!fs.existsSync(src)) {
  process.exit(0);
}

fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.copyFileSync(src, dst);
console.log('[sync-web-favicon] Copied build/icon.png → public/favicon.png');
