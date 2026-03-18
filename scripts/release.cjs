const fs = require('fs');
const { execSync } = require('child_process');
const type = process.argv[2] || 'patch';

if (!['major', 'minor', 'patch'].includes(type)) {
  console.error(`❌ Invalid: ${type}. Use major|minor|patch`);
  process.exit(1);
}

console.log(`📦 VERSION BUMP (${type})`);
if (!fs.existsSync('package.json')) process.exit(1);

// 1. Sync strategy: always use the highest version found in any of the 3 locations
const rootPkgRaw = fs.readFileSync('package.json', 'utf8');
const rootPkg = JSON.parse(rootPkgRaw);
let currentVersion = rootPkg.version || '0.0.0';

const filesToSync = [
  'package.json',
  'extension/package.json',
  'extension/manifest.json'
];

// Check other files to see if they are ahead
filesToSync.forEach(file => {
  if (fs.existsSync(file)) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (data.version && compareVersions(data.version, currentVersion) > 0) {
      currentVersion = data.version;
    }
  }
});

function compareVersions(v1, v2) {
  const p1 = v1.split('.').map(Number);
  const p2 = v2.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (p1[i] > p2[i]) return 1;
    if (p1[i] < p2[i]) return -1;
  }
  return 0;
}

const parts = currentVersion.split('.').map(Number);
switch (type) {
  case 'major': parts[0] += 1; parts[1] = 0; parts[2] = 0; break;
  case 'minor': parts[1] += 1; parts[2] = 0; break;
  case 'patch': parts[2] += 1; break;
}

const nextVersion = parts.join('.');

// 2. Update all files
filesToSync.forEach(file => {
  if (fs.existsSync(file)) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    data.version = nextVersion;
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
    console.log(`✅ ${file} -> ${nextVersion}`);
  }
});

// 3. Rebuild extension to refresh dist/
try {
  console.log('🏗️ Rebuilding extension...');
  execSync('cd extension && npm run build', { stdio: 'pipe' });
  console.log('✅ Extension rebuilt successfully');
} catch (e) {
  console.error('❌ Build failed during release:', e.message);
}

// 4. Git actions
try {
  execSync('git add -A', { stdio: 'ignore' });
  execSync(`git commit -m "chore: release v${nextVersion}"`, { stdio: 'ignore' });
  execSync(`git tag v${nextVersion}`, { stdio: 'ignore' });
  console.log(`🚀 Committed and tagged: v${nextVersion}`);
} catch (e) {
  console.log('⚠️ Git actions skipped (branch might be dirty or tag exists)');
}
