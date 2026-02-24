# Bug Log

| ID | Status | Severity | Description | Fix |
|----|--------|----------|-------------|-----|
| BUG-000 | CLOSED | Low | System Initialization | - |
| BUG-001 | CLOSED | High | UI changes not visible in browser | Migrated logic from legacy `src/popup` to active `src/ui` (React) and fixed manifest paths. |
| BUG-002 | CLOSED | Medium | Report Scam Modal fails "detection script not loaded" | Added `OPEN_REPORT_MODAL` handler and generic `showReportModal` function to `content-main.js`. |
| BUG-037 | CLOSED | High | Runtime Error (No tab with id / Unknown Message) | Added `sendResponse` to default case in Content Script and wrapped `chrome.action` calls in try-catch in Service Worker. |
| BUG-053 | CLOSED | Medium | Extension Version Sync Failure (dist/ lag) | Added `npm run build` to `deploy.md` workflow and refactored `vite.config.js` to use absolute paths for manifest sync. |
| BUG-054 | CLOSED | High | Recurring "No tab with id" errors in service worker | Added "No tab with id" error message to graceful handling in `sendMessageToTab` function. Created regression test to prevent recurrence. |
| BUG-055 | CLOSED | High | Ghost Badge Discrepancy (Badge shows but Popup says Secure) | Fixed `tabId` retrieval in `popup.jsx` and added "Risk Indicators" section to explain warnings. Explicitly cleared badge for SAFE sites in SW. |
| BUG-056 | CLOSED | High | Uncaught (in promise) Error: No tab with id | Awaited `chrome.action` badge calls and wrapped them in `try-catch` with `ignoreTabError` in `icon-manager.js`. |
| BUG-057 | CLOSED | High | Ghost Badge Discrepancy (Badge shows warning but popup shows "No Threats Detected") | Added "message port closed" to graceful error handling in `messaging.js`. Synced scan results to `tabStateManager` in `service-worker.js` so badge and popup read from same data source. |
| BUG-058 | CLOSED | High | Uncaught (in promise) Error: No tab with id (in handleThreat) | Added `await` keywords to `chrome.action.setBadgeText` and `setBadgeBackgroundColor` calls in `handleThreat` function in `service-worker.js`. Created regression test BUG-058.test.js. |
| BUG-059 | CLOSED | High | Ghost Badge Discrepancy (Yellow exclamation but no info in popup) | Updated `syncIconForTabFromCache` in `icon-manager.js` to sync cached results to `tabStateManager`. Passed the manager through the navigation handler context in `service-worker.js`. |
| BUG-060 | CLOSED | Medium | Popup UI is cluttered and "unfriendly" for seniors | Refactored `popup.jsx` for calm SAFE state (neutral slate), softened CAUTION copy ("Take a moment"), reordered accordion (reasons-first), and implemented robust navigation fallback. |
| BUG-061 | CLOSED | High | Dashboard/Logs links in popup lead to 404 error | Updated `handleOpenTab` in `popup.jsx` to correctly target integrated options page with URL hashes (`#logs`, `#settings`). |
| BUG-062 | CLOSED | Medium | Yellow exclamation badge flashes briefly on navigation | Updated `navigation-handler.js` to clear badge state immediately on navigation. Aligned `service-worker.js` and `icon-manager.js` to treat `LOW` severity as `SAFE` for badge purposes. |
| BUG-063 | CLOSED | Medium | Ghost Badge Discrepancy ("!" badge shows for LOW severity while Popup is SAFE) | Prevented LOW severity items from triggering `handleThreat` inside `scanAndHandle` in the service worker. |
| BUG-065 | CLOSED | High | Ghost Badge on Safe Sites (Single soft signal triggering MEDIUM severity) | Fixed `determineSeverity` in `scoring.js` to return `LOW` for any single soft signal. Only 2+ soft signals escalate to `MEDIUM`. |
| BUG-066 | CLOSED | High | Ghost Badge on every page (overallSeverity field mismatch) | Modified `createScanResult` in `scan-schema.js` to correctly expose `overallSeverity` and `overallThreat` fields, ensuring proper badge logic. |
| BUG-067 | CLOSED | Low | Detection Result box is always red in Modal | Modified `src/ui/options/options.jsx` to make the "Detection Result" box color conditional on severity (Emerald for SAFE/LOW/NONE). |
| BUG-068 | CLOSED | Critical | Authority impersonation gift card scam not detected | Expanded `email-heuristics.js` with: religious/org authority titles (father/pastor/priest), 'get reimbursed', 'done today', and authority pressure + secrecy language pattern. |
| BUG-069 | CLOSED | Medium | Icon is solid green square & Email scam not triggered | Fixed icon tinting in `icon-manager.js` by using `multiply` blend mode to preserve detail. Fixed email scan trigger in `email-scanner.js` by including `isEmailView: true` and sender data in the payload. |
| BUG-070 | CLOSED | Critical | Scam email still not triggering Red icon/Overlay | Resolved logic gap in `detector.js` where `emailScams` and `urgencySignals` results from `analyzeUrl` were being ignored for global severity calculation. |
| BUG-071 | CLOSED | Critical | Email Scanner dead (Uncaught ReferenceError) | Fixed `ReferenceError: parseSenderInfo is not defined` in `email-scanner.js` by adding the missing import from `../lib/scanner/parser.js`. |
| BUG-072 | CLOSED | Medium | Overlay "Reason" button is not interactive | Added clickable expansion to the "Reason" button in `content.js`, revealing a technical details panel populated from `result.checks`. Refactored `content.js` for testability. |
