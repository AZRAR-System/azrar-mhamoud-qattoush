import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import { ESLint } from 'eslint';

const targets = ['src/**/*.{ts,tsx,js,jsx}'];
if (fs.existsSync(path.join(process.cwd(), 'electron'))) {
  targets.push('electron/**/*.{ts,tsx,js,jsx}');
}

const topN = Number(process.argv[2] || 15);

async function main() {
  const eslint = new ESLint({ cwd: process.cwd() });
  const results = await eslint.lintFiles(targets);

  let warnings = 0;
  let errors = 0;
  const ruleCounts = new Map();
  const fileCounts = new Map();

  for (const r of results) {
    warnings += r.warningCount || 0;
    errors += r.errorCount || 0;

    const total = (r.warningCount || 0) + (r.errorCount || 0);
    if (total > 0) fileCounts.set(r.filePath, total);

    for (const m of r.messages) {
      const id = m.ruleId || '(no-rule)';
      ruleCounts.set(id, (ruleCounts.get(id) || 0) + 1);
    }
  }

  const topRules = [...ruleCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topFiles = [...fileCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN);

  const cwd = process.cwd() + path.sep;

  process.stdout.write(`ESLint totals: ${errors} error(s), ${warnings} warning(s)\n`);
  process.stdout.write('Top rules:\n');
  for (const [ruleId, count] of topRules) {
    process.stdout.write(`- ${count}\t${ruleId}\n`);
  }

  process.stdout.write(`Top files (top ${topN}):\n`);
  for (const [filePath, count] of topFiles) {
    process.stdout.write(`- ${count}\t${String(filePath).replace(cwd, '')}\n`);
  }
}

main().catch((err) => {
  process.stderr.write(String(err?.stack || err) + '\n');
  process.exitCode = 1;
});
