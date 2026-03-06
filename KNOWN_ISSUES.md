# Known Issues — Hydra Guard Extension

## Active Issues

_No active issues at this time._

## Resolved (Archived)

### ~~BUG: `extractHostname()` not imported in `detector.js`~~ — FIXED (Week 5)
- **File:** `src/lib/detector.js` (lines 142, 171)
- **Severity:** Medium — silently degraded detection
- **Fix:** Added `import { extractHostname } from './analyzer/url-engine.js'`

### ~~BUG: `showWarningOverlay()` not defined in `content-main.js`~~ — FIXED (Week 5)
- **File:** `src/content/content-main.js` (line 90)
- **Severity:** Medium — SHOW_WARNING handler was broken
- **Fix:** Full `showWarningOverlay()` implementation added with Shadow DOM overlay

## Cleanup History

- **Phase 25.0 (2026-03-05):** Removed `extension/legacy/` directory (MV2 background.js and content.js). Removed old release ZIPs (v1.0.38, v1.0.52) from repo root. Migrated `supabase.js` from direct Supabase client to edge function calls. Upgraded `database.js` to dual-source pattern sync.
- **Previous:** Removed `content-main.js` (legacy non-ESM duplicate of content.js). Deprecated `calculateRiskScore()` and `determineRiskLevel()` removed from scoring.js.
