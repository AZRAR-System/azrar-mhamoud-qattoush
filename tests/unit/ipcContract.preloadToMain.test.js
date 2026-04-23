import fs from 'node:fs';
import path from 'node:path';

const readText = (p) => fs.readFileSync(p, 'utf8');

const walk = (dir, out = []) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
};

const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const extractPreloadInvokeChannels = (src) => {
  const channels = new Set();
  const patterns = [
    /ipcRenderer\.invoke\(\s*['"]([^'\"]+)['"]/g,
    /ipcRenderer\.send\(\s*['"]([^'\"]+)['"]/g,
  ];

  for (const re of patterns) {
    let m;
    while ((m = re.exec(src))) {
      const ch = String(m[1] || '').trim();
      if (ch) channels.add(ch);
    }
  }

  return [...channels].sort();
};

const extractHandledChannels = (tsSources) => {
  const handled = new Set();

  const handlerPatterns = [
    /ipcMain\.handle\(\s*['"]([^'\"]+)['"]/g,
    /ipcMain\.on\(\s*['"]([^'\"]+)['"]/g,
    /handleTrusted\(\s*['"]([^'\"]+)['"]/g,
  ];

  for (const src of tsSources) {
    for (const re of handlerPatterns) {
      let m;
      while ((m = re.exec(src))) {
        const ch = String(m[1] || '').trim();
        if (ch) handled.add(ch);
      }
    }
  }

  return handled;
};

describe('IPC contract: preload -> main handlers', () => {
  test('all ipcRenderer channels used in preload are handled in main process', () => {
    const root = process.cwd();

    const preloadPath = path.join(root, 'electron', 'preload.ts');
    const preloadSrc = readText(preloadPath);
    const invoked = extractPreloadInvokeChannels(preloadSrc);

    const electronDir = path.join(root, 'electron');
    const electronTsFiles = walk(electronDir).filter((p) => p.endsWith('.ts'));
    const electronTsSources = electronTsFiles.map((p) => readText(p));

    const handled = extractHandledChannels(electronTsSources);

    const missing = invoked.filter((ch) => !handled.has(ch));

    // This test acts as a safety net: if preload adds a channel but main doesn't handle it,
    // the renderer would fail at runtime.
    expect(missing).toEqual([]);

    // Sanity: ensure we actually collected something.
    expect(invoked.length).toBeGreaterThan(5);
    expect(handled.size).toBeGreaterThan(5);

    // Extra: ensure app:* channels are included too.
    const appInvoked = invoked.filter((c) => c.startsWith('app:'));
    for (const ch of appInvoked) {
      expect(handled.has(ch)).toBe(true);
    }

    // Guard against false positives: confirm at least one handled channel appears as a handler call.
    const sample = invoked.find((c) => c.startsWith('db:'));
    if (sample) {
      const re = new RegExp(`ipcMain\\.handle\\(\\s*['\"]${escapeRegExp(sample)}['\"]`);
      const found = electronTsSources.some((src) => re.test(src));
      expect(found).toBe(true);
    }
  });
});
