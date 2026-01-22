---
name: plan
description: Research and architectural planning. NO code changes.
---
steps:

- name: Consult Memory
    command: node scripts/consult.js
- name: Analyze Architecture
    command: cat docs/architecture.md
- name: Output Plan
    command: echo "Drafting implementation plan..."
