# Enhancement & Tech Debt Backlog
Tracks out-of-scope ideas and debt.
Format: | ID | Title | Status | Priority | Notes |
|---|---|---|---|---|
| HG-DEBT-01 | Refactor `extension/src/background/messages/handler.js` | Backlog | Medium | Exceeds 500 lines. Split into specialized handlers. |
| HG-DEBT-02 | Refactor `extension/src/content/email/dashboard.js` | Backlog | Low | Exceeds 500 lines. Move UI building to components. |
| HG-DEBT-03 | Clean up unused `.js` scripts in root | Backlog | Low | Redundant with `.cjs` versions in many cases. |
| HG-FEAT-01 | Config-driven Email Client Detection | Backlog | Medium | Replace hardcoded domain checks with a registry of client signatures (URL patterns + DOM selectors). |
