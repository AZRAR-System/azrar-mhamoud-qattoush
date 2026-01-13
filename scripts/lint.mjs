import process from 'node:process';
import { ESLint } from 'eslint';

const targets = [
  'src/**/*.{ts,tsx,js,jsx}',
  'electron/**/*.{ts,tsx,js,jsx}',
];

async function main() {
  const eslint = new ESLint({
    cwd: process.cwd(),
  });

  const results = await eslint.lintFiles(targets);

  let output = '';
  try {
    const formatter = await eslint.loadFormatter('stylish');
    output = formatter.format(results);
  } catch {
    // If formatter loading fails for any reason, fall back to JSON.
    output = JSON.stringify(results, null, 2);
  }

  if (output.trim()) {
    process.stdout.write(output);
    if (!output.endsWith('\n')) process.stdout.write('\n');
  }

  const errorCount = results.reduce((sum, r) => sum + (r.errorCount || 0), 0);
  const warningCount = results.reduce((sum, r) => sum + (r.warningCount || 0), 0);

  // Ensure reliable exit codes regardless of shell/npm quirks.
  process.exitCode = errorCount > 0 ? 1 : 0;

  // Helpful one-line summary for CI logs.
  process.stdout.write(`ESLint summary: ${errorCount} error(s), ${warningCount} warning(s)\n`);
}

main().catch((err) => {
  process.stderr.write(String(err?.stack || err) + '\n');
  process.exitCode = 2;
});
