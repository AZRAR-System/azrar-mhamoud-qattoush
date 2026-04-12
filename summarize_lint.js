const fs = require('fs');

try {
  const content = fs.readFileSync('current_lint_results.json', 'utf16le');
  const results = JSON.parse(content);
  
  const summary = results.map(file => {
    const warnings = file.messages.filter(m => m.severity === 1);
    const errors = file.messages.filter(m => m.severity === 2);
    if (warnings.length === 0 && errors.length === 0) return null;
    
    return {
      filePath: file.filePath,
      errorCount: errors.length,
      warningCount: warnings.length,
      messages: file.messages.map(m => `L${m.line}: ${m.message} [${m.ruleId}]`)
    };
  }).filter(Boolean);

  fs.writeFileSync('lint_summary.json', JSON.stringify(summary, null, 2));
  console.log('Summarized ' + summary.length + ' files with issues.');
} catch (e) {
  console.error(e);
}
