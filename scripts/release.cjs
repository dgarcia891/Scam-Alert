const fs = require('fs');
const { execSync } = require('child_process');
const type = process.argv[2] || 'patch';

if (!['major', 'minor', 'patch'].includes(type)) {
  console.error(`❌ Invalid: ${type}. Use major|minor|patch`);
  process.exit(1);
}

console.log(`📦 VERSION BUMP (${type})`);
if (!fs.existsSync('package.json')) process.exit(1);

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const parts = (pkg.version || '0.0.0').split('.').map(Number);

switch (type) {
  case 'major':
    parts[0] += 1;
    parts[1] = 0;
    parts[2] = 0;
    break;
  case 'minor':
    parts[1] += 1;
    parts[2] = 0;
    break;
  case 'patch':
    parts[2] += 1;
    break;
}

pkg.version = parts.join('.');
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log(`✅ Version bumped to: ${pkg.version}`);

try {
  execSync(`git tag v${pkg.version}`, { stdio: 'ignore' });
  console.log(`✅ Git tag created: v${pkg.version}`);
} catch (e) {
  console.log('⚠️ Git tag skipped');
}
