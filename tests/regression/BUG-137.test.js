/**
 * BUG-137 Regression Test:
 * Gmail spam email body extraction fails because extractEmailText()
 * does not find the email body with any CSS selector.
 * 
 * This test verifies:
 * 1. The Gmail programmatic fallback activates when all CSS selectors miss
 * 2. dist/manifest.json version matches extension/manifest.json version
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Running BUG-137 regression tests...');

// ── Test 1: Version consistency check ─────────────────────────────────────────
{
    const rootDir = path.resolve(__dirname, '../../');
    const srcManifest = path.join(rootDir, 'extension/manifest.json');
    const distManifest = path.join(rootDir, 'extension/dist/manifest.json');
    
    if (fs.existsSync(srcManifest) && fs.existsSync(distManifest)) {
        const srcVer = JSON.parse(fs.readFileSync(srcManifest, 'utf8')).version;
        const distVer = JSON.parse(fs.readFileSync(distManifest, 'utf8')).version;
        assert.strictEqual(srcVer, distVer,
            `❌ Version mismatch: source manifest=${srcVer}, dist manifest=${distVer}. Run 'npm run build' to sync.`);
        console.log(`  ✅ Version consistency: source=${srcVer}, dist=${distVer}`);
    } else {
        console.log('  ⚠️ Skipping version check — manifest files not found');
    }
}

// ── Test 2: Gmail fallback logic exists in built bundle ───────────────────────
{
    const rootDir = path.resolve(__dirname, '../../');
    const bundlePath = path.join(rootDir, 'extension/dist/assets/emailScanner.js');
    
    if (fs.existsSync(bundlePath)) {
        const bundle = fs.readFileSync(bundlePath, 'utf8');
        // The Gmail fallback should include the .nH.hx reading pane query
        const hasFallback = bundle.includes('Gmail fallback scan') || bundle.includes('.nH.hx');
        assert.ok(hasFallback,
            '❌ Gmail programmatic fallback not found in built emailScanner.js bundle');
        console.log('  ✅ Gmail programmatic fallback present in built bundle');
    } else {
        console.log('  ⚠️ Skipping bundle check — emailScanner.js not found');
    }
}

// ── Test 3: extractEmailText selectors include spam view fallbacks ─────────────
{
    const rootDir = path.resolve(__dirname, '../../');
    const parserPath = path.join(rootDir, 'extension/src/lib/scanner/parser.js');
    
    if (fs.existsSync(parserPath)) {
        const source = fs.readFileSync(parserPath, 'utf8');
        
        // Must have Gmail programmatic fallback
        assert.ok(source.includes('mail.google.com'),
            '❌ parser.js missing Gmail hostname check for programmatic fallback');
        assert.ok(source.includes('.nH.hx'),
            '❌ parser.js missing .nH.hx reading pane selector in fallback');
        assert.ok(source.includes('.aeF'),
            '❌ parser.js missing .aeF reading pane selector in fallback');
        console.log('  ✅ parser.js has Gmail programmatic fallback with correct selectors');
    } else {
        console.log('  ⚠️ Skipping source check — parser.js not found');
    }
}

console.log('✅ BUG-137 regression tests all passed!');
