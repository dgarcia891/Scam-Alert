# Project Context

## Current State

- **Mode:** CHROME
- **Version:** 1.0.76
- **Orchestrator:** v20.7

## Project Config

- **Git Mode:** SOLO

## Active Work

- Resolved BUG-058: Unhandled promise rejections in service worker
- Resolved BUG-059: Ghost Badge state discrepancy
- Resolved BUG-060: Refactor Popup UI for Seniors

## Recent Changes

- Refined popup UI (BUG-060): Neutral SAFE state, softer CAUTION copy, and reasons-first details accordion.
- Codified "Boring SAFE UI" design rule in `architecture/CONVENTIONS.md`.
- Fixed unhandled promise rejections in `handleThreat` (BUG-058).
- Synchronized `tabStateManager` with cache in `syncIconForTabFromCache` (BUG-059).
