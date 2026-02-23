# Project Context

## Current State

- **Mode:** CHROME
- **Version:** 1.0.86
- **Orchestrator:** v22.0

## Project Config

- **Git Mode:** SOLO

## Active Work

- Improved Activity Log: Expose detailed checks per scan (clickable analysis tags)
- Resolved BUG-066: Ghost Badge Root Cause (overallSeverity field mismatch)
- Resolved BUG-065: Single soft signals (suspicious TLD) triggering MEDIUM severity

## Recent Changes

- Enhanced `scan-schema.js` and `detector.js` to preserve `checks` objects for UI detail.
- Updated heuristic engines to provide `description` and `dataChecked` for clickable tags.
- Verified fix for persistent ghost badge on safe sites via `overallSeverity` canonicalization.
