const fs = require('fs');
const { execSync } = require('child_process');
const type = process.argv[2] || 'patch';
console.log(`📦 Version Bump: ${type}`);
if (!fs.existsSync('package.json')) process.exit(1);
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
let parts = pkg.version.split('.').map(Number);
if (type === 'major') { parts[0]++; parts[1]=0; parts[2]=0; }
else if (type === 'minor') { parts[1]++; parts[2]=0; }
else parts[2]++;
const ver = parts.join('.');
pkg.version = ver;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
if (fs.existsSync('manifest.json')) {
  const m = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  m.version = ver;
  fs.writeFileSync('manifest.json', JSON.stringify(m, null, 2));
}
try { execSync(`git tag v${ver}`); console.log(`✅ Tagged v${ver}`); } catch {}
