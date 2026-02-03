# Bug Log

| ID | Status | Severity | Description | Fix |
|----|--------|----------|-------------|-----|
| BUG-000 | CLOSED | Low | System Initialization | - |
| BUG-001 | CLOSED | High | UI changes not visible in browser | Migrated logic from legacy `src/popup` to active `src/ui` (React) and fixed manifest paths. |
| BUG-002 | CLOSED | Medium | Report Scam Modal fails "detection script not loaded" | Added `OPEN_REPORT_MODAL` handler and generic `showReportModal` function to `content-main.js`. |
| BUG-037 | CLOSED | High | Runtime Error (No tab with id / Unknown Message) | Added `sendResponse` to default case in Content Script and wrapped `chrome.action` calls in try-catch in Service Worker. |
