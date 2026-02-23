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
