# Known Issues — Scam Alert Extension

Discovered during automated test development (Weeks 1–3). These are source-level
bugs that should be fixed in a future release.

---

## BUG: `extractHostname()` not imported in `detector.js`

**File:** `src/lib/detector.js` (lines 142, 171)  
**Severity:** Medium — silently degrades detection  
**Found:** Week 1 (detector-integration.test.js)

`detector.js` calls `extractHostname(url)` in the PhishTank and Google Safe
Browsing check blocks, but never imports it from `url-engine.js`. Because both
calls are wrapped in try/catch, the `ReferenceError` is swallowed and the
checks silently return empty results. This means **PhishTank and GSB lookups
are effectively disabled** at runtime.

**Fix:** Add at the top of `detector.js`:
```js
import { extractHostname } from './analyzer/url-engine.js';
```

---

## BUG: `showWarningOverlay()` not defined in `content-main.js`

**File:** `src/content/content-main.js` (line 90)  
**Severity:** Medium — SHOW_WARNING message handler broken  
**Found:** Week 3 (content-main.test.js)

The `chrome.runtime.onMessage` listener handles the `show_warning` message type
by calling `showWarningOverlay(data.result)`, but this function is never defined
in the file. At runtime this throws a `ReferenceError`.

The ESM content script (`src/content/content.js`) has a working `createOverlay()`
function that appears to be the intended implementation.

**Fix:** Either:
1. Define `showWarningOverlay()` in `content-main.js`, or
2. Rename the call to use the overlay logic already present in the file
   (e.g., reuse the `showTopBanner` or inline modal patterns)

---

## NOTE: `content-main.js` and `content.js` overlap

**Files:** `src/content/content-main.js` (non-ESM) and `src/content/content.js` (ESM)

Both files implement:
- Form submit interception
- `SHOW_WARNING` message handler
- Warning overlay creation
- Report modal

There is no import relationship between them. The manifest should load only one.
Consolidating to a single canonical entry point would eliminate confusion and
the `showWarningOverlay` bug above.

---

## NOTE: Deprecated exports in `scoring.js`

**File:** `src/lib/analysis/scoring.js`

`calculateRiskScore()` and `determineRiskLevel()` are deprecated legacy functions.
Console deprecation warnings have been added. These should be removed once all
callers have migrated to `determineSeverity()`.
