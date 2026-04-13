# Changelog

## [1.1.19] - 2026-04-02

### Fixed

- **BUG-150: Heuristic Calibration**: Reduced "Sender display name mismatch" score from +35 to +15. This prevents legitimate enterprise emails (e.g. Workday, Jira) from triggering a High Risk alert in isolation while maintaining detection strength when combined with other signals.
- **BUG-151: UI Routing Consistency**: Fixed missing interstitial threat dashboard on email navigation. Alerts are now correctly routed to the native email scanner UI instead of the web-page overlay.
- **BUG-152: Feedback Persistence**: Resolved silent failure of "Mark as Safe" feedback. The background now awaits backend sync and provides a explicit "Saved locally" fallback UI if the server is unreachable.
- **Version Bump**: Incremented extension version to 1.1.19.

## [1.1.9] - 2026-04-01

### Added
- **Tiered Risk UI**: Centralized human-friendly labels for all scan heuristics.
- **Diagnostic Log**: New toggleable section in the Risk Overlay for technical transparency.
- **Improved UI Robustness**: Added fallback formatting for unmapped scan keys and view-guarding for technical logs.

### Fixed
- Fixed CSS padding issue in the technical breakdown rows.
- Synced labeling between the Popup Dev Panel and Content Script.

## [1.1.8] - 2026-04-01
### Fixed
- Resolved Service Worker registration failure by eliminating dynamic imports in the background worker.

## [1.1.7] - 2026-04-01
### Added
- Expanded Gmail and Outlook scanner selectors.
