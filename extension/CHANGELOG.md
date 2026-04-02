# Changelog

## [1.1.18] - 2026-04-02

### Added

- **On-Demand Content Script Injection (BUG-148)**: Background service worker now automatically re-injects the email scanner script if the content script becomes unresponsive (e.g., after an extension update or reload).
- **Synchronized Manual Scan Payload**: Manual context extraction now provides the full body content, links, and metadata expected by the heuristic engine.

### Fixed

- **Heuristic Deduplication (BUG-149)**: Fixed exponential risk scoring caused by multiple tracking links triggering the same vulnerability flags.
- **ESP Tracking Wrapper Exemption**: Added an exemption list for common Email Service Providers (Vialoops, Klaviyo, HubSpot, etc.) to prevent false "URL Obfuscation" flags on legitimate marketing links.
- **Source Link Deduplication**: Normalized and deduplicated the link source array to prevent redundant heuristic checks and improve scan performance.

### Security

- Hardened the `GET_EMAIL_CONTEXT` messaging protocol to ensure reliable context capture in complex Gmail DOM environments.

## [1.1.14] - 2026-04-02

### Added

- Multi-word phishing phrase detection for email security (e.g., "verify your identity", "account suspended").
- Individual word extraction logic for visual highlighting (fixes Gmail DOM fragmentation issues).
- Detailed, context-aware tooltips for security highlights in the email body.

### Fixed

- **Visual Regression**: Restored visual highlights in the Gmail UI which were missing due to DOM node splitting.
- **Tooltip Clarity**: Replaced confusing generic "scam examples" in tooltips with context-specific reasons for word flags.
- **False Positives**: Hardened detection with a `>= 2` phrase threshold to ensure legitimate transactional emails are not flagged.

### Security

- Improved brand spoofing detection specifically for email prefixes.
