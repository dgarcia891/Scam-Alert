# Enhancement & Tech Debt Backlog

Tracks out-of-scope ideas and debt.
Format: | ID | Title | Status | Priority | Notes |
|---|---|---|---|---|
| HG-DEBT-01 | Refactor `extension/src/background/messages/handler.js` | Complete | Medium | Split into `ai-handler.js` and `report-handler.js`. |
| HG-DEBT-02 | Refactor `extension/src/content/email/dashboard.js` | Backlog | Low | Exceeds 500 lines. Move UI building to components. |
| HG-DEBT-03 | Clean up unused `.js` scripts in root | Backlog | Low | Redundant with `.cjs` versions in many cases. |
| HG-FEAT-01 | Config-driven Email Client Detection | Complete | Medium | Migrated to central registry in v1.0.152. |
| HG-FEAT-02 | AI Confidence Visualizer in Admin UI | Backlog | Low | Expose AI reputation checks & Gemini debug logs to admins. |
| HG-FEAT-03 | Visual Destination Resolver | Backlog | Low | Shows the actual destination URL when @ obfuscation is detected (resolving `user@fake.com@real-destination.com`). |
| HG-FEAT-04 | Email Selector Debug Panel | Backlog | Low | Log which selectors match/miss to pinpoint extraction gaps without DevTools. |
| HG-DEBT-04 | Shared JSON Robustness Utility | Backlog | Low | Centralize "fuzzy" JSON parsing for all background message handlers. |
