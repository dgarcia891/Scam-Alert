---
name: build
description: "Implement planned changes using architect skills and thoroughness-first rules."
---

# Workflow: build

1. Load Implementation Plan
   - Retrieve the current Implementation Plan for this task.
   - Summarize:
     - Scope of changes.
     - Files/areas to touch.
     - Planned database/config changes.
     - Tests/checks to add or update.

2. Learn from Recent Work
   - Read recent entries from:
     - docs/logs/BUG_LOG.md
     - docs/logs/LESSONS_LEARNED.md
   - Skim docs/architecture/DECISIONS.md for decisions related to this feature.
   - Adjust test and implementation strategy to:
     - Cover previously fragile areas.
     - Avoid patterns called out as problematic.

3. Identify Surfaces
   - Confirm which surfaces the plan touches:
     - Lovable UI components/pages/routes.
     - Supabase schema/data or queries.
     - External APIs/integrations.
   - Note any high-risk surfaces.

4. Architect Skill Integration (if relevant)
   - If any Lovable/Supabase/sync surface is involved:
     - Activate and follow `lovable_architect`.
   - Apply its constraints to:
     - Which files/directories are safe to edit.
     - How DB changes must be represented (migrations).
     - How routing/UX changes must behave.

5. Prepare Context
   - Open and review all files to be modified.
   - Check for discrepancies between the Implementation Plan and the actual code.
   - If discrepancies are major, update the plan (or return to /plan) before heavy changes.

6. Implement Changes
   - Follow the Implementation Plan step-by-step:
     - Edit/create only scoped files unless the plan is updated.
     - Keep files within reasonable size; refactor before they become too large.
   - For database changes:
     - Create/update migration files (e.g., under supabase/migrations/) rather than editing schema directly.
     - Add comments and Business Impact labels.
   - Keep changes small, reviewable, and consistent with existing patterns.

7. Update/Add Tests
   - Implement or update tests described in the plan and informed by BUG_LOG/LESSONS_LEARNED.
   - Ensure tests cover:
     - Main success path.
     - Known edge cases.
     - Any previous regression areas.

8. Handoff to Verification & Critic
   - Summarize:
     - Updated Implementation Plan (if changed).
     - Files changed.
     - Migrations created/updated.
     - Tests added/updated.
   - Do not declare DONE here.
   - Return data for `/verify` and critic workflows or for the dev loop controller.
