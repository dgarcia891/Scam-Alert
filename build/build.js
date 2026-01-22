/**
 * Build Script
 * 
 * Bundles extension files into dist/ for distribution.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

console.log('🔨 Building Scam Alert extension...\n');

// Clean dist directory
if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true });
}
fs.mkdirSync(DIST);

// Copy manifest
console.log('📝 Copying manifest.json');
fs.copyFileSync(
    path.join(ROOT, 'manifest.json'),
    path.join(DIST, 'manifest.json')
);

// Copy src directory
console.log('📂 Copying src/ directory');
copyDir(path.join(ROOT, 'src'), path.join(DIST, 'src'));

// Copy icons (if they exist)
const iconsDir = path.join(ROOT, 'icons');
if (fs.existsSync(iconsDir)) {
    console.log('🎨 Copying icons/');
    copyDir(iconsDir, path.join(DIST, 'icons'));
} else {
    console.warn('⚠️  No icons/ directory found - extension needs icons!');
}

console.log('\n✅ Build complete!');
console.log(`📦 Output: ${DIST}`);

/**
 * Recursively copy directory
 */
function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}
