const fs = require('fs');

try {
  const filePath = 'current_lint_results.json';
  let buffer = fs.readFileSync(filePath);
  let rawData;
  
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
    rawData = fs.readFileSync(filePath, 'utf16le');
  } else {
    rawData = buffer.toString('utf8');
  }
  
  if (rawData.charCodeAt(0) === 0xFEFF) rawData = rawData.slice(1);
  const data = JSON.parse(rawData);
  const summary = data.map(file => {
    if (file.warningCount > 0 || file.errorCount > 0) {
      return {
        path: file.filePath,
        warnings: file.messages.map(m => `L${m.line}:${m.column} [${m.ruleId}] ${m.message}`)
      };
    }
    return null;
  }).filter(Boolean);

  console.log(JSON.stringify(summary, null, 2));
} catch (err) {
  console.error(err);
}
