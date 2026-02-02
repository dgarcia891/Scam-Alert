#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status

echo "═══════════════════════════════════════════════════════════════"
echo "🔧 ORCHESTRATOR v19.2 (TURNKEY CHROME SWARM) - CJS FIX"
echo "═══════════════════════════════════════════════════════════════"

# ┌─────────────────────────────────────────────────────────────────┐
# │ PHASE 1: PURGE LEGACY │
# └─────────────────────────────────────────────────────────────────┘
echo ""
echo "🗑️ Phase 1: Purging legacy artifacts..."
rm -f .agent/.version 2>/dev/null || true
rm -f scripts/deploy.sh 2>/dev/null || true
find . -maxdepth 1 -name "ANTIGRAVITY_*" -delete 2>/dev/null || true
echo " ✓ Clean slate"

# ┌─────────────────────────────────────────────────────────────────┐
# │ PHASE 2: IDENTITY & STRUCTURE │
# └─────────────────────────────────────────────────────────────────┘
echo ""
echo "📁 Phase 2: Creating structure..."
touch ANTIGRAVITY_v19.2_CHROME_ACTIVE
mkdir -p .agent/{rules,workflows}
mkdir -p docs
mkdir -p scripts
mkdir -p src/{background,content,popup,lib}
mkdir -p tests/{unit,regression}
mkdir -p icons
mkdir -p dist
echo " ✓ Directories created"
echo " ✓ Beacon: ANTIGRAVITY_v19.2_CHROME_ACTIVE"

# ┌─────────────────────────────────────────────────────────────────┐
# │ PHASE 3: DOCUMENTATION │
# └─────────────────────────────────────────────────────────────────┘
echo ""
echo "📜 Phase 3: Writing documentation..."

# === ORCHESTRATOR MANIFEST ===
cat > docs/ORCHESTRATOR_MANIFEST.md << 'EOF'
# Orchestrator Manifest (v19.2)

## 1. Core Identity
| Attribute | Requirement |
|-----------|-------------|
| **Role** | Chrome Extension Architect (Manifest V3) |
| **Runtime** | Service Workers ONLY (no background.html) |
| **State** | `chrome.storage.local` (no global variables) |
| **Security** | Strict CSP · No eval() · No inline scripts |

## 2. Safety Clamps (Non-Negotiable)
- **Relative Paths:** Absolute paths (`/`, `~`) are FORBIDDEN
- **500-Line Limit:** Files exceeding 500 lines require refactor
- **Drift Check:** Code must match `architecture.md`
- **No Blind Deletes:** `rm -rf` requires explicit user confirmation

## 3. Swarm Protocol
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Mock-Writer │ ──► │   Builder   │ ──► │ Orchestrator│
│   (Tests)   │     │    (Code)   │     │   (Verify)  │
└─────────────┘     └─────────────┘     └─────────────┘
```

## 4. Workflow Commands
| Command | Purpose | Headless? |
|---------|---------|-----------|
| `/plan` | Impact analysis (READ ONLY) | ✓ |
| `/build` | Parallel test + code generation | ✓ |
| `/fix [ID]` | Two-Strike bug repair | ✓ |
| `/deploy` | Security → Drift → Test → Build → Push | ✓ |
| `/verify` | Visual browser inspection | ✗ |
| `/bug_report` | Log issue (NO CODE) | ✓ |

## 5. Forbidden Patterns
- `eval()`
- `new Function()`
- `innerHTML` (unless sanitized)
- `document.write()`
- `chrome.tabs.executeScript` (Use `chrome.scripting`)
EOF

# === ARCHITECTURE ===
cat > docs/architecture.md << 'EOF'
# Architecture Specification

## Directory Structure
```
├── manifest.json       # V3 manifest (entry point)
├── src/
│   ├── background/     # Service Worker (NO DOM access)
│   ├── content/        # Content scripts (DOM access)
│   ├── popup/          # Extension popup UI
│   └── lib/            # Shared utilities
├── tests/
│   ├── unit/           # Jest + jest-chrome mocks
│   └── regression/     # Bug regression tests
└── dist/               # Build output (git-ignored)
```

## Data Flow
```
[User Action] → [Popup/Content] → chrome.runtime.sendMessage()
                                         ↓
[Storage Update] ← [Service Worker] ← [Message Handler]
```
EOF

# === BUG LOG ===
cat > docs/BUG_LOG.md << 'EOF'
# Bug Log
| ID | Status | Severity | Description | Fix |
|----|--------|----------|-------------|-----|
| BUG-000 | CLOSED | Low | System Initialization | - |
EOF

echo " ✓ Documentation complete"

# ┌─────────────────────────────────────────────────────────────────┐
# │ PHASE 4: RULES │
# └─────────────────────────────────────────────────────────────────┘
echo ""
echo "📏 Phase 4: Installing rules..."

cat > .agent/rules/core_standards.md << 'EOF'
# Core Standards (v19.2)

1. **Manifest V3 Only:** Service Workers, no background pages.
2. **500-Line Limit:** Refactor any file >500 lines.
3. **Test-First:** Write failing test BEFORE implementation.
4. **Drift Guard:** Verify `architecture.md` matches reality.
5. **No `eval`:** Strict CSP compliance.
EOF

echo " ✓ Rules installed"

# ┌─────────────────────────────────────────────────────────────────┐
# │ PHASE 5: WORKFLOWS │
# └─────────────────────────────────────────────────────────────────┘
echo ""
echo "⚙️ Phase 5: Installing workflows..."

# /plan
cat > .agent/workflows/plan.md << 'EOF'
---
name: plan
description: Architectural blueprint with Impact Report. READ ONLY.
---
1. Load Context
   node scripts/consult.cjs
   // turbo

2. Drift Check
   node scripts/drift_check.cjs
   // turbo

3. Blueprint Generation
   echo "📝 Drafting Implementation Plan..."
   echo "⚠️ CONSTRAINT: Output Markdown ONLY. Do not write files."
   // turbo

4. Stop
   echo "🛑 PLAN COMPLETE. Run /build to execute."
   // turbo
EOF

# /build
cat > .agent/workflows/build.md << 'EOF'
---
name: build
description: Spawns Swarm (Test + Code) based on Spec.
---
1. Architecture Load
   cat docs/architecture.md
   // turbo

2. Swarm Init
   echo "🚀 Spawning Mock-Writer (tests/unit) and Builder (src/)..."
   // turbo

3. Parallel Execution
   echo "Writing tests to tests/unit/ (using jest-chrome)..." 
   echo "Writing code to src/..."
   // turbo

4. Verification
   npm run test:unit
   // turbo
EOF

# /fix
cat > .agent/workflows/fix.md << 'EOF'
---
name: fix
description: Two-Strike Repair with Test-First Debugging.
---
1. Recall
   node scripts/consult.cjs
   // turbo

2. Reproduction (Strike 0)
   echo "🧪 Writing failing regression test..."
   npm run test:unit
   // turbo

3. Attempt 1 (Strike 1)
   echo "🛠️ Applying fix..."
   // turbo

4. Verification
   npm run test:unit
   // Instruction: If fails, try Attempt 2. If Attempt 2 fails, STOP.

5. Close Loop
   echo "✅ Fix Verified. Updating Bug Log..."
   // turbo
EOF

# /deploy
cat > .agent/workflows/deploy.md << 'EOF'
---
name: deploy
description: Secure Release Pipeline (Scan -> Test -> Build -> Tag -> Push).
---
1. Security & Drift Gate
   node scripts/security_scan.cjs && node scripts/drift_check.cjs
   // turbo

2. Test Gate
   npm run test:unit
   // turbo

3. Release
   echo "📦 Bumping Version & Building..."
   node scripts/release.cjs patch && node scripts/build.cjs
   // turbo

4. Push
   git push origin main --tags
   // turbo

5. Done
   echo "✅ Deployed. Run /verify to visually inspect."
   // turbo
EOF

# /verify
cat > .agent/workflows/verify.md << 'EOF'
---
name: verify
description: Visual browser inspection.
---
1. Launch Browser
   node scripts/visual_audit.cjs
   // turbo
EOF

# /bug_report
cat > .agent/workflows/bug_report.md << 'EOF'
---
name: bug_report
description: Logs issue to docs/BUG_LOG.md. NO CODE.
---
1. Context Scan
   node scripts/consult.cjs
   // turbo

2. Log Entry
   echo "📝 Appending to docs/BUG_LOG.md (Status: OPEN)..."
   // turbo
EOF

# ┌─────────────────────────────────────────────────────────────────┐
# │ PHASE 6: INFRASTRUCTURE SCRIPTS │
# └─────────────────────────────────────────────────────────────────┘
echo ""
echo "🔧 Phase 6: Creating scripts (CJS for compatibility)..."

# scripts/consult.cjs
cat > scripts/consult.cjs << 'EOF'
const fs = require('fs');
const files = ['docs/ORCHESTRATOR_MANIFEST.md', 'docs/architecture.md', 'docs/BUG_LOG.md'];
console.log('🧠 LOADING CONTEXT...');
files.forEach(f => {
  if (fs.existsSync(f)) {
    console.log(`\n--- ${f} ---\n` + fs.readFileSync(f, 'utf8').substring(0, 1500));
  }
});
EOF

# scripts/security_scan.cjs
cat > scripts/security_scan.cjs << 'EOF'
const fs = require('fs');
const path = require('path');
const BANNED = ['eval(', 'innerHTML', 'document.write', 'setTimeout("'];
function scan(dir) {
  let err = false;
  fs.readdirSync(dir).forEach(f => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (f !== 'node_modules' && f !== '.git') if (scan(p)) err = true;
    } else if (/\.(js|ts)$/.test(f)) {
      const content = fs.readFileSync(p, 'utf8');
      BANNED.forEach(b => {
        if (content.includes(b)) { console.error(`❌ SECURITY: ${b} in ${p}`); err = true; }
      });
    }
  });
  return err;
}
if (scan('.')) process.exit(1);
console.log("✅ Security Scan Passed");
EOF

# scripts/drift_check.cjs
cat > scripts/drift_check.cjs << 'EOF'
const fs = require('fs');
const path = require('path');
if (!fs.existsSync('docs/architecture.md')) { console.warn("⚠️ No architecture doc"); process.exit(0); }
// Check file size limits
function checkSize(dir) {
  let err = false;
  if (!fs.existsSync(dir)) return err;
  fs.readdirSync(dir).forEach(f => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory() && f !== 'node_modules') {
      if (checkSize(p)) err = true;
    } else if (/\.(js|ts)$/.test(f)) {
      if (fs.readFileSync(p, 'utf8').split('\n').length > 500) {
        console.error(`❌ DRIFT: ${p} > 500 lines`);
        err = true;
      }
    }
  });
  return err;
}
if (checkSize('src')) process.exit(1);
console.log("✅ Architecture Compliance Verified");
EOF

# scripts/release.cjs
cat > scripts/release.cjs << 'EOF'
const fs = require('fs');
const { execSync } = require('child_process');
const type = process.argv[2] || 'patch';
console.log(`📦 Version Bump: ${type}`);
if (!fs.existsSync('package.json')) process.exit(1);
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
let parts = pkg.version.split('.').map(Number);
if (type === 'major') { parts[0]++; parts[1]=0; parts[2]=0; }
else if (type === 'minor') { parts[1]++; parts[2]=0; }
else parts[2]++;
const ver = parts.join('.');
pkg.version = ver;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
if (fs.existsSync('manifest.json')) {
  const m = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  m.version = ver;
  fs.writeFileSync('manifest.json', JSON.stringify(m, null, 2));
}
try { execSync(`git tag v${ver}`); console.log(`✅ Tagged v${ver}`); } catch {}
EOF

# scripts/build.cjs
cat > scripts/build.cjs << 'EOF'
const fs = require('fs');
const path = require('path');
console.log("📦 Building...");
if (fs.existsSync('dist')) fs.rmSync('dist', { recursive: true });
fs.mkdirSync('dist');
if (fs.existsSync('manifest.json')) fs.copyFileSync('manifest.json', 'dist/manifest.json');
function copy(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest);
  fs.readdirSync(src).forEach(f => {
    const s = path.join(src, f), d = path.join(dest, f);
    fs.statSync(s).isDirectory() ? copy(s, d) : fs.copyFileSync(s, d);
  });
}
copy('src', 'dist');
copy('icons', 'dist/icons');
console.log("✅ Build Complete");
EOF

# scripts/visual_audit.cjs
cat > scripts/visual_audit.cjs << 'EOF'
const { exec } = require('child_process');
const cmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
console.log("👁️ Launching Chrome...");
exec(`${cmd} chrome://extensions`);
EOF

# scripts/setup_env.cjs (The Wiring)
cat > scripts/setup_env.cjs << 'EOF'
const fs = require('fs');
const { execSync } = require('child_process');

console.log("🔧 CONFIGURING ENVIRONMENT...");

// 1. Initialize package.json if missing
if (!fs.existsSync('package.json')) {
    console.log("📦 Creating package.json...");
    execSync('npm init -y', { stdio: 'ignore' });
}

// 2. Inject Dependencies (CRITICAL FOR TURNKEY OPERATION)
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.scripts = {
    ...pkg.scripts,
    "build:legacy": "node scripts/build.cjs",
    "release:legacy": "node scripts/release.cjs",
    "test:unit:legacy": "jest tests/unit --passWithNoTests",
    "scan": "node scripts/security_scan.cjs",
    "drift": "node scripts/drift_check.cjs"
};

// Ensure devDependencies exist
pkg.devDependencies = pkg.devDependencies || {};
const requiredDeps = {
    "jest": "^29.0.0",
    "jest-chrome": "^0.8.0",
    "eslint": "^8.0.0"
};

Object.entries(requiredDeps).forEach(([dep, ver]) => {
    if (!pkg.devDependencies[dep]) {
        pkg.devDependencies[dep] = ver;
        console.log(` + Added ${dep}`);
    }
});

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
console.log("✅ package.json ready.");
EOF

# ┌─────────────────────────────────────────────────────────────────┐
# │ PHASE 7: EXECUTION │
# └─────────────────────────────────────────────────────────────────┘
echo ""
echo "🚀 Phase 7: Finalizing..."

# Create manifest.json template
cat > manifest.json << 'EOF'
{
  "manifest_version": 3,
  "name": "Antigravity Extension",
  "version": "1.0.0",
  "background": { "service_worker": "service-worker.js" },
  "permissions": ["storage"],
  "action": { "default_popup": "popup.html" }
}
EOF

# Create Jest Config
cat > jest.config.js << 'EOF'
module.exports = {
  testEnvironment: 'node',
  setupFiles: ['./tests/setup.js'],
  roots: ['<rootDir>/tests']
};
EOF

# Create Jest Setup
cat > tests/setup.js << 'EOF'
global.chrome = {
  runtime: { sendMessage: jest.fn(), onMessage: { addListener: jest.fn() } },
  storage: { local: { get: jest.fn(), set: jest.fn() } }
};
EOF

# Run Setup
node scripts/setup_env.cjs

echo "═══════════════════════════════════════════════════════════════"
echo "✅ ORCHESTRATOR v19.2 INSTALLED (CJS COMPATIBLE)"
echo "👉 FINAL STEP: Run 'npm install' to download the injected dependencies."
echo "═══════════════════════════════════════════════════════════════"
