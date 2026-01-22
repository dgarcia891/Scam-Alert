---
name: deploy
description: Version Bump -> Test -> Git -> NAS Sync.
---
steps:

- name: Release Protocol
    command: npm run release
- name: Git Push
    command: git push
- name: NAS Sync
    command: bash scripts/deploy.sh
