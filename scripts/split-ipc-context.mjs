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
const slice = lines.slice(0, 2061).join('\n');

let out = slice;
out = out.replace(/from '\.\//g, "from '../");
out = out.replace(/from "\.\//g, 'from "../');

function shouldExportLine(line) {
  if (!line.length) return false;
  if (line[0] === ' ' || line[0] === '\t') return false; // not top-level
  const t = line.trim();
  if (!t || t.startsWith('//')) return false;
  if (t.startsWith('import ')) return false;
  if (t.startsWith('export ')) return false;
  if (t.startsWith('const ') || t.startsWith('let ')) return true;
  if (t.startsWith('async function ') || t.startsWith('function ')) return true;
  if (t.startsWith('type ') || t.startsWith('interface ')) return true;
  return false;
}

const outLines = out.split(/\r?\n/);
const next = outLines.map((line) => {
  if (!shouldExportLine(line)) return line;
  if (line.trim().startsWith('export ')) return line;
  return `export ${line}`;
});

const ipcMutableSetters = `

/** Cross-module writes (ESM imports are read-only for \`let\` bindings). */
export function setDbMaintenanceMode(next: boolean): void {
  dbMaintenanceMode = next;
}

export function setCurrentFeedUrl(next: string | null): void {
  currentFeedUrl = next;
}
`;

fs.writeFileSync('electron/ipc/context.ts', next.join('\n') + ipcMutableSetters + '\n', 'utf8');
console.log('Wrote electron/ipc/context.ts');
