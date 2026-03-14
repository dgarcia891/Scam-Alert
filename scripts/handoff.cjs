const { execSync } = require('child_process');
const fs = require('fs');
const now = new Date().toISOString();

console.log('📋 Generating Handoff\n');
let gitStatus = '(unknown)', currentBranch = '(unknown)', lastCommit = '(unknown)';
try {
  gitStatus = execSync('git status --short').toString().trim() || '(clean)';
  currentBranch = execSync('git branch --show-current').toString().trim();
  lastCommit = execSync('git log -1 --oneline').toString().trim();
} catch (e) {}

const handoff = `
═══════════════════════════════════════════════════
HANDOFF: ${now}
═══════════════════════════════════════════════════
CURRENT STATE:
Branch: ${currentBranch}
Last Commit: ${lastCommit}
GIT STATUS:
${gitStatus}

COMPLETED:
• [Fill in completed tasks]

IN PROGRESS:
• [Fill in ongoing work]

BLOCKERS:
• [Fill in any blockers]

KEY FILES MODIFIED:
• [Fill in modified files]

NEXT STEPS:
• [Fill in recommended next actions]
═══════════════════════════════════════════════════
`;
if (!fs.existsSync('docs/logs')) {
  fs.mkdirSync('docs/logs', { recursive: true });
}
fs.appendFileSync('docs/logs/SESSION_LOG.md', handoff);
console.log(handoff);
console.log('✅ Appended to docs/logs/SESSION_LOG.md');
