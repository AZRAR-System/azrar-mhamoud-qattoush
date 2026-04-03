/**
 * Builds electron/ipc/*.ts register modules from electron/ipc.ts line ranges.
 * Prefixes context exports with `ipc.` in handler bodies.
 * Requires electron/ipc.ts or run from git (git show HEAD:electron/ipc.ts).
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';

function readIpcTsSource() {
  try {
    return fs.readFileSync('electron/ipc.ts', 'utf8');
  } catch {
    return execSync('git show HEAD:electron/ipc.ts', { encoding: 'utf8' });
  }
}

const src = readIpcTsSource();
const lines = src.split(/\r?\n/);

const contextSrc = fs.readFileSync('electron/ipc/context.ts', 'utf8');
const exportNames = [];
for (const line of contextSrc.split(/\r?\n/)) {
  const m =
    line.match(/^export (?:async )?function (\w+)/) ||
    line.match(/^export (?:const|let) (\w+)/) ||
    line.match(/^export type (\w+)/);
  if (m) exportNames.push(m[1]);
}

/** Must not use namespace ipc.* for these (ESM live binding / assignment). Locals can shadow ensureWritableDir. */
const skipPrefixNames = new Set([
  'dbMaintenanceMode',
  'restoreInProgress',
  'currentFeedUrl',
  'lastUpdaterEvent',
  'ensureWritableDir',
]);

function stripTwoSpaces(chunk) {
  return chunk
    .split(/\r?\n/)
    .map((l) => (l.startsWith('  ') ? l.slice(2) : l))
    .join('\n');
}

function extractLineRange(start1, end1) {
  return lines.slice(start1 - 1, end1).join('\n');
}

/** Replace bare identifiers that are context exports with ipc.name; avoid double ipc.ipc. */
function prefixContextExports(code) {
  let out = code;
  const sorted = [...exportNames]
    .filter((n) => !skipPrefixNames.has(n))
    .sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    const re = new RegExp(`(?<!ipc\\.)\\b${name}\\b`, 'g');
    out = out.replace(re, `ipc.${name}`);
  }
  return out;
}

const header = `import type { IpcDeps } from './deps.js';
import * as ipc from './context.js';
import {
  dbMaintenanceMode,
  restoreInProgress,
  currentFeedUrl,
  lastUpdaterEvent,
  setDbMaintenanceMode,
  setCurrentFeedUrl,
} from './context.js';
import { ipcMain, dialog, app, BrowserWindow, shell, safeStorage } from 'electron';
`;

const ipcTsImports = extractLineRange(2, 122)
  .replace(/from '\.\//g, "from '../")
  .replace(/from "\.\//g, 'from "../');

const sections = [
  {
    file: 'printing.ts',
    name: 'registerPrinting',
    ranges: [
      [2064, 2104],
      [2830, 2835],
      [2859, 3041],
      [6840, 7128],
    ],
  },
  {
    file: 'app.ts',
    name: 'registerApp',
    ranges: [[2106, 2196]],
  },
  {
    file: 'license.ts',
    name: 'registerLicense',
    ranges: [
      [2198, 2299],
      [2837, 2857],
    ],
  },
  {
    file: 'licenseAdmin.ts',
    name: 'registerLicenseAdmin',
    ranges: [[2301, 2828]],
  },
  {
    file: 'db.ts',
    name: 'registerDb',
    ranges: [
      [3043, 3128],
      [5120, 5744],
      [6837, 6837],
    ],
  },
  {
    file: 'domain.ts',
    name: 'registerDomain',
    ranges: [[3130, 3783]],
  },
  {
    file: 'sql.ts',
    name: 'registerSql',
    ranges: [[3785, 5118]],
  },
  {
    file: 'attachments.ts',
    name: 'registerAttachments',
    ranges: [[5746, 6835]],
  },
];

for (const sec of sections) {
  let body = sec.ranges.map(([a, b]) => extractLineRange(a, b)).join('\n');
  body = stripTwoSpaces(body);
  body = prefixContextExports(body);

  const out =
    `${header}
${ipcTsImports}

export function ${sec.name}(deps: IpcDeps): void {
  void deps;
${body
  .split('\n')
  .map((l) => `  ${l}`)
  .join('\n')}
}
`;
  const fullMutableImport = `import {
  dbMaintenanceMode,
  restoreInProgress,
  currentFeedUrl,
  lastUpdaterEvent,
  setDbMaintenanceMode,
  setCurrentFeedUrl,
} from './context.js';`;

  let finalOut = out;
  if (sec.file === 'db.ts') {
    finalOut = finalOut.replaceAll('dbMaintenanceMode = true', 'setDbMaintenanceMode(true)');
    finalOut = finalOut.replaceAll('dbMaintenanceMode = false', 'setDbMaintenanceMode(false)');
    finalOut = finalOut.replace(
      fullMutableImport,
      `import { dbMaintenanceMode, setDbMaintenanceMode } from './context.js';`
    );
  } else if (sec.file === 'printing.ts') {
    finalOut = finalOut.replaceAll(
      "import('./printing/preview/previewManager')",
      "import('../printing/preview/previewManager')"
    );
    finalOut = finalOut.replace('currentFeedUrl = normalized', 'setCurrentFeedUrl(normalized)');
    finalOut = finalOut.replace(
      fullMutableImport,
      `import {
  currentFeedUrl,
  lastUpdaterEvent,
  setCurrentFeedUrl,
} from './context.js';`
    );
  } else {
    finalOut = finalOut.replace(
      fullMutableImport,
      `import {
  dbMaintenanceMode,
  restoreInProgress,
  currentFeedUrl,
  lastUpdaterEvent,
} from './context.js';`
    );
  }

  fs.writeFileSync(`electron/ipc/${sec.file}`, finalOut, 'utf8');
  console.log('Wrote', sec.file);
}
