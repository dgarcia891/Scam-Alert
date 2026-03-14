const fs = require('fs');
const rootDir = fs.existsSync('src') ? 'src' : fs.existsSync('extension/src') ? 'extension/src' : null;
if (!rootDir) process.exit(0);
const walk = dir =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = `${dir}/${entry.name}`;
    return entry.isDirectory() ? walk(full) : [full];
  });

const files = walk(rootDir).filter(f => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.jsx'));
files.forEach(f => {
  const lines = fs.readFileSync(f, 'utf8').split('\n').length;
  // Exception for large legacy files
  const legacyFiles = ['handler.js', 'dashboard.js', 'options.jsx', 'popup.jsx'];
  if (legacyFiles.some(lf => f.includes(lf))) return;
  if (lines > 500) {
    console.error('DRIFT VIOLATION: ' + f + ' exceeds 500 lines.');
    process.exit(1);
  }
});
