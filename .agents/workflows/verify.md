---
name: verify
description: "Multi-Agent Verification and Human Sign-off"
---
1. Logic Verification:
   - Spawn a Verification Agent to review changes against the Implementation Plan and DECISIONS.md.
2. Automated Verification:
   - Run all regression tests in tests/regression/.
   - Run `npm run scan` and `npm run drift`.
3. Human Sign-off:
   - Call visual:audit to show changes to the user if applicable.
   - Request final approval.
