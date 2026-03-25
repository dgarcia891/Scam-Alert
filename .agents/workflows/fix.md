---
name: fix
description: "Diagnose and resolve bugs using architect skills and regression-focused testing."
---

# Workflow: fix

1. Understand the Bug
   - Collect:
     - Error messages, stack traces, logs.
     - User reports or tickets.
     - Reproduction steps.
   - Restate:
     - What is happening now.
     - What should happen instead.
     - Suspected impact and severity.

2. Learn from Past Bugs
   - Read recent entries from:
     - docs/logs/BUG_LOG.md
     - docs/logs/LESSONS_LEARNED.md
   - Look for similar incidents and note:
     - Root causes.
     - Fixes that worked.
     - Anti-patterns to avoid.

3. Identify Surfaces
   - Determine if the bug touches:
     - Lovable UI components/pages/routes.
     - Supabase queries, schema, RLS, or auth.
     - External APIs/integrations.
   - Note any high-risk surfaces.

4. Architect Skill Integration (if relevant)
   - If any Lovable/Supabase/sync surface is involved:
     - Activate and follow `lovable_architect`.
   - Use MCP/project/schema analysis (if available) to:
     - Map the bug to specific components/routes/queries.
     - Understand schema and RLS implications.

5. Fix Strategy & Regression Tests
   - Propose a fix strategy that:
     - Respects forbidden zones and DB safety rules.
     - Uses migrations for schema changes instead of ad hoc updates.
   - Design regression tests that:
     - Reproduce the bug.
     - Confirm the fix.
     - Guard adjacent behavior.

6. Implement the Fix
   - Apply minimal, targeted changes:
     - Limit edits to files/modules identified in the strategy.
   - For schema changes:
     - Add/modify migration files with comments and Business Impact labels.

7. Update/Add Tests
   - Implement regression tests.
   - Update existing tests as needed.
   - Ensure tests fail before the fix and pass after the fix where feasible.

8. Validate
   - Run or recommend relevant tests/checks.
   - Note any failing tests and what is required to fix them.

9. Summary & Lessons
   - Summarize:
     - Root cause.
     - Code/config/migrations changed.
     - Tests added/updated and their status.
   - Note any lessons for BUG_LOG, LESSONS_LEARNED, and DECISIONS docs.
