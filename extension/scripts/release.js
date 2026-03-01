/**
 * Smart Release Script (v20.5)
 * Bumps version in package.json AND manifest.json (if present)
 */
import fs from 'fs';
import path from 'path';

const type = process.argv[2] || 'patch'; // major | minor | patch

console.log(`📦 VERSION BUMP (${type})`);

// 1. Calculate New Version
let currentVer = '0.0.0';
if (fs.existsSync('package.json')) {
  currentVer = JSON.parse(fs.readFileSync('package.json', 'utf8')).version || '0.0.0';
} else if (fs.existsSync('manifest.json')) {
  currentVer = JSON.parse(fs.readFileSync('manifest.json', 'utf8')).version || '0.0.0';
}

const parts = currentVer.split('.').map(Number);
// Fixed logic from Patch v20.5 to be semver compliant and valid JS
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
if (fs.existsSync('package.json')) {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.version = newVer;
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
  console.log(` ✅ Updated package.json: ${currentVer} → ${newVer}`);
}

// 3. Update manifest.json (Chrome Extension Strictness)
if (fs.existsSync('manifest.json')) {
  const man = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  man.version = newVer;
  fs.writeFileSync('manifest.json', JSON.stringify(man, null, 2));
  console.log(` ✅ Updated manifest.json: ${newVer}`);
}

console.log(`🚀 Version bumped to ${newVer}`);
