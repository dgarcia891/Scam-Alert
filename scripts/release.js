/**
 * Smart Release Script (v20.5)
 * Bumps version in package.json AND manifest.json (if present)
 */
import fs from 'fs';
import path from 'path';

const type = process.argv[2] || 'patch'; // major | minor | patch
const root = process.cwd();

console.log(`📦 VERSION BUMP (${type})`);

// 1. Calculate New Version
let currentVer = '0.0.0';
const pkgPath = path.join(root, 'package.json');
const manifestPath = path.join(root, 'manifest.json');

if (fs.existsSync(pkgPath)) {
  currentVer = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || '0.0.0';
} else if (fs.existsSync(manifestPath)) {
  currentVer = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).version || '0.0.0';
}

const parts = currentVer.split('.').map(Number);
if (parts.length !== 3) {
  console.error('Invalid version format. Expected x.y.z');
  process.exit(1);
}

switch (type) {
  case 'major':
    parts[0]++;
    parts[1] = 0;
    parts[2] = 0;
    break;
  case 'minor':
    parts[1]++;
    parts[2] = 0;
    break;
  case 'patch':
  default:
    parts[2]++;
    break;
}

const newVer = parts.join('.');

// 2. Update package.json
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version = newVer;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(` ✅ Updated package.json: ${currentVer} → ${newVer}`);
}

// 3. Update manifest.json (Chrome Extension Strictness)
if (fs.existsSync(manifestPath)) {
  const man = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  man.version = newVer;
  fs.writeFileSync(manifestPath, JSON.stringify(man, null, 2) + '\n');
  console.log(` ✅ Updated manifest.json: ${newVer}`);
}

console.log(`🚀 Version bumped to ${newVer}`);
