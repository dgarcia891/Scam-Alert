/**
 * NAS Sync Script
 * 
 * Syncs built extension to Network Attached Storage for team access.
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_PATH = path.join(__dirname, '..', 'dist');
const NAS_PATH = '/Volumes/Projects/Scam Alert/Latest';

console.log('📡 Syncing to NAS...\n');

// Check if NAS is mounted
if (!fs.existsSync('/Volumes/Projects')) {
    console.error('❌ NAS not mounted at /Volumes/Projects');
    console.log('\n💡 Mount the NAS first:');
    console.log('   Go to Finder → Go → Connect to Server');
    console.log('   Enter: smb://192.168.1.88/Projects');
    process.exit(1);
}

// Ensure dist exists
if (!fs.existsSync(DIST_PATH)) {
    console.error('❌ dist/ directory not found');
    console.log('💡 Run `npm run build` first');
    process.exit(1);
}

// Create NAS directory if needed
if (!fs.existsSync(NAS_PATH)) {
    console.log('📁 Creating NAS directory...');
    fs.mkdirSync(NAS_PATH, { recursive: true });
}

try {
    console.log(`Source: ${DIST_PATH}/`);
    console.log(`Target: ${NAS_PATH}/\n`);

    // Sync with rsync
    execSync(
        `rsync -avz --delete --exclude='.DS_Store' "${DIST_PATH}/" "${NAS_PATH}/"`,
        { stdio: 'inherit' }
    );

    console.log('\n✅ Sync complete!');
    console.log(`📦 Extension available at: ${NAS_PATH}`);

} catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    process.exit(1);
}
