---
name: dev-loop
description: "Run a more autonomous development flow using the full dev loop."
---

# Workflow: dev-loop

1. Clarify Task
   - Restate the user’s request and classify trivial vs non-trivial.

2. If Non-Trivial
   - Invoke /plan.
   - Invoke /build using the Implementation Plan.
   - Invoke /verify for tests/checks.
   - Invoke /audit or review using development_critic.
   - Repeat plan → build → verify → audit if needed.

3. If Trivial
   - Ask whether to run the full dev loop or a lighter path.
