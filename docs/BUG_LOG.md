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
