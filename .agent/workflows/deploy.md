---
name: deploy
description: Release with Auto-Versioning (Global Rules §4.1)
---
## Steps

### 1. Quality Gates

```bash
node scripts/security_scan.cjs
node scripts/drift_check.cjs
npm run test:unit
```

### 2. Auto-Version (The Fix)

# Bumps version in manifest.json/package.json

```bash
node scripts/release.js patch
npm run build
```

### 3. Deploy (Commit & Push)

# Commits the version bump along with code changes

```bash
# Force SOLO mode for this environment
GIT_MODE=SOLO node scripts/deploy.js feat "implement layer 4 findings"
```

### 4. Git Mode Logic

| Mode | Commit Type | Action |
|------|-------------|--------|
| SOLO | docs/chore/style | Direct push |
| SOLO | feat/fix/refactor | Branch + PR |
| TEAM | Any | Branch + PR |
