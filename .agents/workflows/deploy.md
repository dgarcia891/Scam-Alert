---
name: deploy
description: "Prepare or validate deployment steps for this change."
---

# Workflow: deploy

1. Scope Changes
   - Summarize what is being deployed:
     - Key features/fixes.
     - Schema/migration changes.
     - Config changes.

2. Checks Before Deploy
   - Ensure relevant tests/checks have been run (or recommended):
     - Refer to /verify output if available.
   - Highlight any remaining failures or risks.

3. Migration & Config Readiness
   - List migrations that must run.
   - Note any manual config steps or environment variable changes.

4. Risk Callouts
   - Call out:
     - Potential regressions.
     - High-risk areas (auth, payments, data loss).

5. Output
   - Provide a concise deployment checklist:
     - Commands.
     - Order of operations.
     - Rollback considerations.
