---
name: plan
description: "Plan and design changes using thorough, multi-angle analysis and relevant architect skills."
---

# Workflow: plan

1. Clarify Request
   - Restate the user’s request in your own words.
   - Classify it as trivial vs non-trivial.
   - If non-trivial, note that this plan is intended for the full dev loop.

2. Load Context
   - Read, if present:
     - README and project overview docs.
     - docs/architecture/architecture.md
     - docs/architecture/DECISIONS.md
     - docs/logs/BUG_LOG.md (recent entries)
     - docs/logs/LESSONS_LEARNED.md (recent entries)
   - Summarize in 3–5 bullets:
     - Relevant architecture decisions.
     - Recent bugs/lessons that affect this request.
     - Constraints to respect.

3. Identify Surfaces
   - Decide which surfaces are involved:
     - Lovable UI components/pages/routes.
     - Supabase schema/data or queries.
     - External APIs or integrations.
     - Any other core modules or high-risk areas (auth, money, security, etc.).
   - Note any high-risk areas explicitly.

4. MCP / Codebase Scan (if non-trivial)
   - Use code navigation or MCP tools to:
     - Locate relevant components, routes, and API handlers.
     - Locate tables/columns or core modules touched by the feature or bug.
   - Record key findings.

5. Activate Architect Skills (if relevant)
   - If the work touches Lovable UI, Supabase, or GitHub sync:
     - Activate and follow `lovable_architect`.
   - Apply any constraints from architect skills to what is allowed and how changes must be represented.

6. Multi-Angle Options
   - For non-trivial design decisions, generate at least 2–3 plausible solution approaches.
   - For each approach, briefly record:
     - Pros and cons.
     - Risks (including regressions and complexity).
     - Impact on tests, migrations, and future work.
   - Select a preferred approach, with rationale.

7. Implementation Plan
   - Produce a structured, step-by-step Implementation Plan that:
     - Names specific files/modules where possible.
     - Specifies DB changes as migrations (not direct schema edits).
     - Identifies tests/checks to add or update.
     - Is small enough to execute in one or a few /build runs.

8. Output for Dev Loop
   - Output:
     - The Implementation Plan.
     - Surfaces affected.
     - Architect skill constraints.
     - Planned tests/checks.
   - Do not implement changes here.
