# Project Context

## Current State

- **Mode:** CHROME
- **Version:** 1.0.150
- **Orchestrator:** v20.7

## Project Config

- **Git Mode:** SOLO

## Active Work

- **Detections**: Finalized AI Second Opinion improvements (debug UI + full email context) and PhishTank removal.

## Recent Changes

- **BUG-096**: Critical fix for Gmail DOM selectors (replaced `.go` with `.gD[email]`) to restore AI context (v1.0.150).
- **BUG-095**: Fixed metadata propagation in `service-worker.js` and `detector.js` to ensure AI context persists (v1.0.149).
- **FEAT-097**: Enriched AI Second Opinion with full email context (sender, subject, body, links) and added Debug Transparency UI (v1.0.148).
- **CHORE**: Completely removed PhishTank integration from all UI and background surfaces (v1.0.147).
- **FEAT-096**: Enhanced AI Verifier Context with Intent Categories and refined heuristic prompts (v1.0.146).
