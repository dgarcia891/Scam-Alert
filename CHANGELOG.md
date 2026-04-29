# Changelog

All notable changes to this project will be documented in this file.

## [1.1.28] - 2026-04-29

### Fixed
- **Gmail Inbox Stuck Scanning (5-Cause Fix)**: Resolved a compound bug where opening the Hydra Guard popup while on the Gmail inbox list view (no email selected) caused the popup to display "Scanning email... We couldn't extract the email content yet. Retrying automatically." indefinitely. Root causes addressed:
  1. Empty Payload Safeguard in service worker now distinguishes inbox list views from failed email extraction, preventing false UNKNOWN escalation.
  2. Content script now propagates `isReadingView` flag to the background so context is available at all pipeline stages.
  3. New `inbox` UI state added to popup — displays a neutral "Inbox View" card instead of an amber retry warning.
  4. Popup auto-rescan loop now guarded to prevent infinite `FORCE_RESCAN` cycles when already confirmed in inbox view.
  5. `FORCE_RESCAN` pipeline short-circuits for inbox views, emitting a stable synthetic result and bypassing `scanUrl()` which would always escalate to UNKNOWN in this context.

## [1.1.27] - 2026-04-17

### Added
- **UI Restoration**: "Trust Site" and "Report Scam" buttons are now permanently visible on the main popup screen for flagged sites, removing the need to dig into the details accordion.
- **Enhanced Developer UX**: Replaced the obscure header "DEV" icon with a clear "Toggle Developer Mode" button in the footer settings panel.
- **Phrase Enforcement Logic**: Implemented a mandatory whitespace check for all remote heuristics. Any single-word patterns fetched from the database (e.g., "bitcoin", "urgent") are now automatically discarded to prevent false positives, strictly enforcing multi-word phrase detection.

### Changed
- **Branding Parity**: Standardized all extension metadata to "Hydra Guard" across `package.json` and `manifest.json`.
- **UI Layout Optimization**: Improved the button grid in the popup to ensure action buttons are prominent and accessible.

### Fixed
- **Troubleshooting Accessibility**: Fixed the regression where the Developer Mode toggle was non-obvious and difficult to find.
- **Generic Word False Positives**: Resolved issues where single keywords in emails would trigger high-severity alerts.

## [1.1.26] - 2026-04-16

### Added
- **Content Extraction Layer**: Navigation-triggered web page scans now extract page `title` and `bodyText` to allow phrase analysis.
- **Standalone Generic Phrase Check**: Uncategorized remote patterns are correctly scanned unconditionally, enabling multi-word scam phrase detection via email.
- **Dual-Path Highlighter**: Safely highlights individual phrases and multi-node UI matches without XSS vulnerabilities.

### Fixed
- **Phrase Engine Case Normalization**: Keyword matching is now case-insensitive, correctly alerting on capitalized DB items like 'IRS'.
- **Category Match Fix**: Addressed issue where remote DB matches tagged as "phrase" failed to execute due to unhandled tags in the scanner engine.

## [1.1.12] - 2026-04-02

### Added
- **Force-Rescan Re-injection**: The "Rescan Email Content" button now programmatically re-injects the email scanner content script if it detects an orphaned connection (after an extension reload).
- **Consolidated Tooltip System**: Tooltips are now managed exclusively by the Shadow DOM-based `tooltip.js`, improving performance and UI consistency.

### Changed
- **Version-Aware Content Script Guard**: The content script double-execution guard now uses the extension version string. This allows new versions to initialize over orphaned scripts from previous versions.
- **Extraction Pipeline Hardening**: Increased extraction retries (5 -> 8) and delay (800ms -> 1000ms) to accommodate slow-loading Gmail views.
- **Skip Generic Scanners for Email**: `checkSuspiciousKeywords`, `urgencySignals`, and `contentAnalysis` are now skipped in email views to prevent false positives on common words like "verify" and "account".
- **Improved Keyword Output**: URL keyword alerts now group findings into a single combined match with contextual explanations rather than individual words.

### Fixed
- **Duplicate Tooltips**: Fixed issue where two overlapping tooltips would appear on highlighted words.
- **Misleading Single-Word Flags**: Fixed issue where benign words like "verify" were individually flagged in email bodies.
- **Empty Payload Caching**: Added a guard to prevent caching "SAFE" results when email extraction exhausts retries with zero content.

## [1.1.11] - 2026-03-29
- Previous release improvements.
