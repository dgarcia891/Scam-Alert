const fs = require('fs');
const path = require('path');
if (!fs.existsSync('docs/architecture.md')) { console.warn("⚠️ No architecture doc"); process.exit(0); }
// Check file size limits
function checkSize(dir) {
  let err = false;
  if (!fs.existsSync(dir)) return err;
  fs.readdirSync(dir).forEach(f => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory() && f !== 'node_modules') {
      if (checkSize(p)) err = true;
    } else if (/\.(js|ts)$/.test(f)) {
      if (fs.readFileSync(p, 'utf8').split('\n').length > 500) {
        console.error(`❌ DRIFT: ${p} > 500 lines`);
        err = true;
      }
    }
  });
  return err;
}
if (checkSize('src')) process.exit(1);
console.log("✅ Architecture Compliance Verified");
