---
name: fix
description: "Two-Strike Bug Repair, Lessons Reuse, and Silent Learning"
---
1. Learn before fixing:
   - Search docs/logs/BUG_LOG.md and docs/logs/LESSONS_LEARNED.md for this bug ID or similar issues.
   - If matches are found, explicitly state:
     - What approaches were tried before.
     - Why those approaches failed or were insufficient.
   - Commit to a different or improved fix strategy rather than repeating a previously failed approach.
2. Reproduce:
   - Write or update a failing regression test in tests/regression/ that reliably reproduces the bug.
3. Review (Critic Agent):
   - SPAWN: `Review Agent` (Planning mode) with this task:
     - "Review the bug description, related BUG_LOG / LESSONS_LEARNED entries, the regression test(s), and the proposed fix approach.
      Check for:
      - Repeating previously failed approaches
      - Missing regression coverage
      - Impact on related modules or surfaces (web, extension, shared)
      - Any risky side effects not addressed
      Output a short list of corrections or confirm that the fix plan is sound."
   - The Review Agent MUST NOT directly change code or tests; it only comments on the plan.
4. Attempt 1:
   - Implement the fix in code.
   - Run the relevant tests (regression + affected unit tests).
5. Attempt 2 (if needed):
   - If Attempt 1 fails, try a second fix with an adjusted strategy.
   - Re-run tests.
   - If Attempt 2 also fails, STOP and spawn a Research Agent; do NOT keep guessing.
6. Log & Learn (MANDATORY once tests pass):
   - Update docs/logs/BUG_LOG.md with the bug and status: FIXED, referencing the regression test file.
   - Update docs/logs/LESSONS_LEARNED.md with the core lesson.
   - If the lesson is architectural or process-level, consider:
     - Adding or updating an ADR in docs/architecture/DECISIONS.md.
     - Adding a backlog item in docs/ENHANCEMENTS.md for follow-up improvements.
