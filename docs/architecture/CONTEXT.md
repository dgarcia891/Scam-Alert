# Project Context

## Current State

- **Mode:** CHROME
- **Version:** 1.0.108
- **Orchestrator:** v22.0

## Project Config

- **Git Mode:** SOLO

## Active Work

- **BUG-084 Fix**: Resolving "More Info" refresh loop.
- Core logic implemented via MutationObserver guard in `mutation-observer.js` (scan suppression).
- Verified with 142/142 tests passing, including regressions for toggle and navigation.

## Recent Changes

- **BUG-083**: Added `checkSuspiciousPort` and Vague Lure heuristics (v1.0.107).
- **BUG-084**: Suppressed email observer rescan while overlay is active (v1.0.108).
- Finalized BUG-084 fix by removing aggressive click-interceptors that broke JSDOM tests.
