---
name: plan
description: "Contextual Planner, Lessons Intake, and Gap Analysis"
---
1. Context load:
   - Run `node scripts/consult.cjs` or `node scripts/consult.js` if available.
   - Use MCP `analyze_project` to map current state.
2. Learn from history (recent incidents):
   - Read the last ~200 lines from:
     - docs/logs/BUG_LOG.md
     - docs/logs/LESSONS_LEARNED.md
   - Read docs/architecture/DECISIONS.md.
   - Identify any bugs, anti-patterns, or decisions relevant to the current request.
   - Explicitly state in the plan how you will avoid repeating known failed approaches.
3. Gap Analysis:
   - Compare the user request against docs/architecture/architecture.md (or equivalent architecture doc).
   - Identify gaps in:
     - Features
     - Tests
     - Docs
     - Data model / Supabase
4. Output:
   - Produce a concise Implementation Plan that:
     - References any relevant ADRs.
     - Notes DB impact (Destructive/Risky/Safe) if database changes are likely.
   - STOP after outputting the plan. Do NOT modify any files or run terminal commands until explicitly instructed to implement.
