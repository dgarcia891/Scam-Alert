const fs = require('fs');
const path = require('path');
const BANNED = ['eval(', 'document.write', 'setTimeout("'];
function scan(dir) {
  let err = false;
  fs.readdirSync(dir).forEach(f => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (f !== 'node_modules' && f !== '.git' && f !== 'scripts' && f !== 'tests') if (scan(p)) err = true;
    } else if (/\.(js|ts)$/.test(f)) {
      const content = fs.readFileSync(p, 'utf8');
      BANNED.forEach(b => {
        if (content.includes(b)) { console.error(`❌ SECURITY: ${b} in ${p}`); err = true; }
      });
    }
  });
  return err;
}
if (scan('.')) process.exit(1);
console.log("✅ Security Scan Passed");
