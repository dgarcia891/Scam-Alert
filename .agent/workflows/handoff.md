---
name: handoff
description: Session archive (Global Rules §6.2)
---
## Steps

### 1. Generate Handoff

```bash
node scripts/handoff.cjs
```

### 2. Complete Template

Fill in the generated template in `docs/logs/SESSION_LOG.md`.

### 3. Commit

```bash
git add docs/logs/SESSION_LOG.md docs/architecture/CONTEXT.md
git commit -m "docs: session handoff [orchestrator]"
```

# Push logic handled by user preference or deploy script
