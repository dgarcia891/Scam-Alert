---
name: fix
description: Test-Driven Bug Fixing Loop.
---
steps:

- name: Active Recall
    command: node scripts/consult.js
- name: Reproduce Failure
    command: npm run test:regression -- --watch
- name: Log Bug
    command: echo "Update docs/BUG_LOG.md before coding."
