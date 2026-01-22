---
name: build
description: Spawns parallel agents to build features + tests.
---
steps:

- name: Verify Architecture
    command: cat docs/architecture.md
- name: Spawn Builders
    command: echo "Spawning Mock-Writer and Developer Agents..."
- name: Run Tests
    command: npm test
