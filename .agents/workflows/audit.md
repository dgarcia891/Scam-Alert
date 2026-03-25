---
name: audit
description: "Audit recent work or responses for correctness, evidence, and alignment with Global Rules."
---

# Workflow: audit

1. Load Target
   - Identify what is being audited:
     - A recent answer.
     - A set of code changes.
     - A plan or design.

2. Apply development_critic
   - Activate `development_critic`.
   - Provide:
     - The plan or description of changes.
     - The code/config/migrations.
     - The tests/checks and results.

3. Produce Audit Output
   - Summarize:
     - BLOCKING issues.
     - NON-BLOCKING suggestions.
     - Overall quality and risk level.
