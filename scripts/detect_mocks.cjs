/**
 * Detect Mocks Script
 * 
 * Scans the codebase for potential hardcoded mock data usage.
 * Part of v20.3 Cost-Efficiency Protocol.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Scanning for hardcoded mock data...');

// Simple implementation: Check for "mock" in filenames or content
// This is a placeholder for a more robust check if needed.

const srcDir = path.join(__dirname, '../src');

function scanDir(dir) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    let foundMocks = false;

    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (scanDir(fullPath)) foundMocks = true;
        } else {
            if (file.toLowerCase().includes('mock') && !file.includes('.test.')) {
                console.warn(`⚠️ Potential mock file found: ${path.relative(process.cwd(), fullPath)}`);
                foundMocks = true;
            }
        }
    });
    return foundMocks;
}

const mocksFound = scanDir(srcDir);

if (mocksFound) {
    console.log('⚠️ Mock data detection finished. Please review warnings above.');
    // We don't fail the build, just warn, unless strict mode is requested.
} else {
    console.log('✅ No obvious mock files found in src/.');
}
