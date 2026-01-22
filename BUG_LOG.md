# BUG_LOG.md

| ID | Description | Resolution |
|----|-------------|------------|
| BUG-001 | Service worker registration failed (Status 15) with TypeError 'create' of undefined | [RESOLVED] Added missing 'alarms' permission to manifest.json. |
| BUG-002 | PhishTank database download error: Resource::kQuotaBytes quota exceeded            | [RESOLVED] Added `unlimitedStorage` permission to manifest.json. |
| BUG-003 | Popup shows "Not yet scanned" on active pages (e.g., Yahoo)                         | [RESOLVED] Implemented Startup Scan Sweep and Popup Auto-trigger. |
| BUG-005 | Popup state incorrect/broken after clicking "Proceed anyway" on threat alert        | [RESOLVED] Implemented URL normalization for cache consistency. |
| BUG-006 | Persistent 404 error when downloading PhishTank database (even with HTTP)           | [RESOLVED] Added User-Agent headers and unified URL normalization. |
