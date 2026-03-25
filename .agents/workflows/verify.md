---
name: verify
description: "Run or recommend tests and checks, and summarize results."
---

# Workflow: verify

1. Identify Relevant Checks
   - Determine which tests/checks apply to this change:
     - Unit tests.
     - Integration or end-to-end tests.
     - Lint and static analysis.
     - Build or bundle checks.
     - Any project-specific commands.

2. Run or Recommend
   - If able, run the appropriate test/check commands.
   - If not, list the exact commands the user or CI should run.

3. Record Results
   - For each command:
     - State whether it ran.
     - Provide pass/fail result.
     - Note any failures with brief context.

4. Output
   - Return a structured summary of:
     - Commands run.
     - Results.
     - Commands not run and why.
