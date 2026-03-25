---
name: development_critic
description: "Global development critic: structured review of plans, code, migrations, and tests across this workspace."
triggers: ["critic", "review", "audit", "plan-review", "code-review", "test-review", "check-work"]
---
# Development Critic Skill

## 1. Purpose

Provide a reusable, workspace-wide "check your work" pass for:
- Implementation Plans.
- Code/config/migration changes.
- Tests and quality checks.

## 2. Two-Pass Review Mode

1. **Adversarial pass ("cranky senior engineer")**
   - Assume the plan or code is flawed.
   - Look for:
     - Incorrect behavior or logic errors.
     - Security or privacy issues.
     - Schema and migration risks.
     - Architectural violations or boundary breaks.
     - Missing, weak, or brittle tests.
   - Mark issues as:
     - BLOCKING — must be fixed before DONE.
     - NON-BLOCKING — can be follow-up work.

2. **Collaborative pass ("senior teammate")**
   - Acknowledge strengths (clarity, good patterns, strong test coverage).
   - Suggest concrete improvements:
     - Simplifications, better structure, clearer naming.
     - Additional tests/checks that meaningfully reduce risk.
   - Re-confirm which issues are truly BLOCKING.

## 3. Scope of Critique

The critic should:
- Focus on correctness, safety, maintainability, and test coverage.
- Check alignment with:
  - AntiGravity Global Rules.
  - Any relevant orchestrator manifest for this repo.
  - Any relevant architect skills (e.g., lovable_architect for Lovable/Supabase work).

## 4. Output Format

The critic should produce:
- A short summary of overall quality.
- A list of BLOCKING issues with:
  - What is wrong.
  - Why it matters.
  - How to fix it.
- A list of NON-BLOCKING suggestions.
- A final verdict:
  - "BLOCKING issues present" or
  - "No blocking issues; only non-blocking suggestions."
