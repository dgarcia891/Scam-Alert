import { execSync } from 'child_process';
import fs from 'fs';

console.log('🔍 Running Active Recall (consult.js)...');

const docsPath = './docs';
const bugLogPath = './BUG_LOG.md';

if (fs.existsSync(bugLogPath)) {
    console.log('\n--- BUG_LOG.md ---');
    console.log(fs.readFileSync(bugLogPath, 'utf8').split('\n').slice(-10).join('\n'));
}

if (fs.existsSync(docsPath)) {
    console.log('\n--- Architecture & Docs (grep keywords) ---');
    try {
        const output = execSync('grep -r "TODO\\|FIXME\\|IMPORTANT" ./docs | head -n 10').toString();
        console.log(output);
    } catch (e) {
        console.log('No recent notes found.');
    }
}
