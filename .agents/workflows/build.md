---
name: build
description: "Aggressive Parallel Swarm Execution with Lessons-Aware TDD"
---
1. Learn from recent work:
   - Read the last ~200 lines from:
     - docs/logs/BUG_LOG.md
     - docs/logs/LESSONS_LEARNED.md
   - Skim docs/architecture/DECISIONS.md for decisions related to this feature.
   - Adjust your test strategy to:
     - Cover previously fragile areas.
     - Avoid patterns called out as problematic in prior lessons.
2. Trigger Swarm:
   - SPAWN: `Test Writer Agent` (Fast Mode) -> "Write or update regression and unit tests in tests/unit/ and tests/regression/ for the requested feature."
   - SPAWN: `Developer Agent` (Fast Mode) -> "Implement logic in src/ or supabase/functions/ according to the plan and tests."
   - Both agents must run in parallel, not strictly sequentially.
3. Execution:
   - Ensure tests are created/updated before finalizing implementation changes.
   - Keep files under the 500-line limit; refactor before adding to any file that would exceed it.
4. Verification:
   - Run `npm test` or `npm run test:unit` (as appropriate for this repo).
   - Run `npm run scan` and `npm run drift`.
   - If any tests fail, iterate within this workflow until all are green.
5. Output:
   - Summarize:
     - Files changed.
     - New/updated tests.
     - Any lessons that should later be captured in LESSONS_LEARNED.md or DECISIONS.md.
