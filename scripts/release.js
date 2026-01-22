import fs from 'fs';
import { execSync } from 'child_process';

console.log('🚀 Running Release Engine...');

// 1. Run tests
try {
    console.log('Running tests...');
    execSync('npm test', { stdio: 'inherit' });
} catch (e) {
    console.error('Tests failed. Aborting release.');
    process.exit(1);
}

// 2. Increment version (simplified example)
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const versionParts = pkg.version.split('.').map(Number);
versionParts[2]++; // increment patch
pkg.version = versionParts.join('.');
fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2));

if (fs.existsSync('./manifest.json')) {
    const manifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf8'));
    manifest.version = pkg.version;
    fs.writeFileSync('./manifest.json', JSON.stringify(manifest, null, 2));
}

console.log(`✅ Version bumped to ${pkg.version}`);
