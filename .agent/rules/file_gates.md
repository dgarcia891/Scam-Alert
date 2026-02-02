# Chrome File Gates (v14.2)

## ✅ SAFE TO EDIT
*   `src/components/` (Popup/Options UI)
*   `src/logic/` (Business Logic)
*   `src/content/` (Content Scripts)

## ⚠️ RESTRICTED (Architectural Core)
*   `manifest.json`: **READ-ONLY** unless explicitly authorized for permission changes.
*   `src/background/`: **Service Worker Only**. No persistent variables (use storage).

## ❌ FORBIDDEN
*   `src/background/background.html` (Manifest V2 Legacy - DO NOT CREATE)
*   Inline Scripts (CSP Violation)
*   Files > 500 Lines (Refactor Mandatory)
