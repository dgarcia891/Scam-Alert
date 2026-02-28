# Known Issues — Scam Alert Extension

Discovered during automated test development (Weeks 1–4). Status updated as
bugs are fixed.

---

## ~~BUG: `extractHostname()` not imported in `detector.js`~~ FIXED

**File:** `src/lib/detector.js` (lines 142, 171)  
**Severity:** Medium — silently degraded detection  
**Found:** Week 1 (detector-integration.test.js)  
**Fixed:** Week 5 — added `import { extractHostname } from './analyzer/url-engine.js'`

`detector.js` called `extractHostname(url)` in the PhishTank and Google Safe
Browsing check blocks, but never imported it from `url-engine.js`. Because both
calls were wrapped in try/catch, the `ReferenceError` was swallowed and the
checks silently returned empty results. PhishTank and GSB `checks` entries
are now populated correctly.

---

## ~~BUG: `showWarningOverlay()` not defined in `content-main.js`~~ FIXED

**File:** `src/content/content-main.js` (line 90)  
**Severity:** Medium — SHOW_WARNING message handler was broken  
**Found:** Week 3 (content-main.test.js)  
**Fixed:** Week 5 — added full `showWarningOverlay()` implementation

The `chrome.runtime.onMessage` listener handled the `show_warning` message type
by calling `showWarningOverlay(data.result)`, but this function was never defined
in the file. A full warning overlay implementation has been added with:
- Full-page dark overlay with severity-aware title (Critical vs High)
- Technical findings list from flagged checks
- Go Back / Proceed buttons
- Reason toggle to show/hide details

---

## NOTE: `content-main.js` and `content.js` overlap

**Files:** `src/content/content-main.js` (non-ESM) and `src/content/content.js` (ESM)  
**Status:** Documented — `content.js` is canonical (build target)

The Vite build script compiles `content.js` → `assets/content.js` which is what
the manifest loads. `content-main.js` is a legacy non-ESM version. Both files
implement overlapping functionality:
- Form submit interception
- `SHOW_WARNING` message handler
- Warning overlay creation
- Report modal

Consolidating to the single canonical entry point (`content.js`) would eliminate
redundancy. Consider removing `content-main.js` once all legacy references are cleared.

---

## NOTE: Deprecated exports in `scoring.js`

**File:** `src/lib/analysis/scoring.js`

`calculateRiskScore()` and `determineRiskLevel()` are deprecated legacy functions.
Console deprecation warnings have been added. These should be removed once all
callers have migrated to `determineSeverity()`.
