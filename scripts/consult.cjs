const fs = require('fs');
const files = ['docs/architecture/CONTEXT.md', 'docs/logs/BUG_LOG.md', 'docs/logs/LESSONS_LEARNED.md'];
files.forEach(f => {
  if (fs.existsSync(f)) {
    console.log(`\n--- ${f} ---\n` + fs.readFileSync(f, 'utf8').split('\n').slice(-50).join('\n'));
  }
});
