const fs = require('fs');
const files = ['docs/ORCHESTRATOR_MANIFEST.md', 'docs/architecture.md', 'docs/BUG_LOG.md'];
console.log('🧠 LOADING CONTEXT...');
files.forEach(f => {
  if (fs.existsSync(f)) {
    console.log(`\n--- ${f} ---\n` + fs.readFileSync(f, 'utf8').substring(0, 1500));
  }
});
