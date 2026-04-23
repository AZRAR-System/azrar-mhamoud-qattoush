const fs = require('fs');
const path = require('path');

const summary = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'));

const files = Object.entries(summary)
  .filter(([key]) => key !== 'total')
  .map(([filePath, data]) => {
    return {
      path: filePath,
      relPath: path.relative(process.cwd(), filePath),
      pct: data.lines.pct,
      uncoveredLines: data.lines.total - data.lines.covered,
      uncoveredFunctions: data.functions.total - data.functions.covered
    };
  })
  .filter(f => f.pct < 80)
  .sort((a, b) => a.pct - b.pct);

console.log('File | Coverage % | Uncovered Lines | Uncovered Functions');
console.log('--- | --- | --- | ---');
files.forEach(f => {
  console.log(`${f.relPath} | ${f.pct}% | ${f.uncoveredLines} | ${f.uncoveredFunctions}`);
});

const totalLines = summary.total.lines.total;
const coveredLines = summary.total.lines.covered;
const neededLines = Math.ceil(totalLines * 0.8) - coveredLines;
console.log(`\nTotal Lines: ${totalLines}`);
console.log(`Covered Lines: ${coveredLines}`);
console.log(`Needed for 80%: ${neededLines}`);
console.log(`Estimated tests (at 15 lines/test): ${Math.ceil(neededLines / 15)}`);
