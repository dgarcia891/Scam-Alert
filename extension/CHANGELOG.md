# Changelog

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
