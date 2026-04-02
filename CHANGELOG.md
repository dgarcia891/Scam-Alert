# Changelog

All notable changes to this project will be documented in this file.

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
