Orchestrator Manifest (v20.7)
Compliance: Implements ANTIGRAVITY_GLOBAL_RULES_v1.1

## Core Protocols

• **Single Source of Truth**: `docs/architecture/CONTEXT.md`
• **Two-Strike Rule**: If fix fails twice, STOP and escalate.
• **Git Mode**: SOLO (Direct push allowed for chores) vs TEAM (PR Only).

## Workflows

| Command | Purpose |
|---------|---------|
| `/plan` | Architecture blueprint + Active Recall |
| `/build` | Parallel Test & Code Generation |
| `/deploy` | Version Bump -> Build -> Git Push |
| `/fix` | Two-Strike Bug Repair (Test-Driven) |
| `/bug_report` | Log issue (Read-Only/No Code) |
| `/handoff` | Session Archival & Context Save |
