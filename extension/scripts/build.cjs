const fs = require('fs');
const path = require('path');
console.log("📦 Building...");
if (fs.existsSync('dist')) fs.rmSync('dist', { recursive: true });
fs.mkdirSync('dist');
if (fs.existsSync('manifest.json')) fs.copyFileSync('manifest.json', 'dist/manifest.json');
function copy(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest);
  fs.readdirSync(src).forEach(f => {
    const s = path.join(src, f), d = path.join(dest, f);
    fs.statSync(s).isDirectory() ? copy(s, d) : fs.copyFileSync(s, d);
  });
}
copy('src', 'dist');
copy('icons', 'dist/icons');
console.log("✅ Build Complete");
