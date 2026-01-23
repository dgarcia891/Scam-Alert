# Product Requirements Document: Scam Alert

## Overview

**Name**: Scam Alert  
**Type**: Chrome Extension (Manifest V3)  
**Purpose**: Real-time scam and phishing protection for seniors and all web users

## Problem Statement

Online scams targeting seniors are increasing. Users need automatic, passive protection that:

- Detects scams in real-time before users interact
- Requires no technical knowledge to operate
- Provides clear, actionable warnings
- Works silently in the background

## Solution

A Chrome extension that combines multiple detection methods:

1. **Google Safe Browsing API** - Industry-standard malware/phishing database
2. **PhishTank** - Community-driven phishing detection (offline + online)
3. **Pattern Detection** - Heuristic analysis of suspicious URL patterns
4. **Content Analysis** - Page content scanning for scam indicators

## Current Product Behavior (As Built Today)

- The extension primarily evaluates the **website address (URL)** and optional **reputation checks**.
- "Concerning keywords" currently refers to **words found in the URL**, not the page’s text.
- Page text/content analysis is not part of the default scanning pipeline unless a content script explicitly collects and provides it.

## Core Features

### 1. Real-Time URL Scanning

- **Trigger**: User navigates to new URL
- **Action**: Scan URL through detection pipeline
- **Output**: Risk assessment (SAFE, LOW, MEDIUM, HIGH, CRITICAL)

### 2. Warning Overlay

- **Trigger**: Threat detected (MEDIUM or higher)
- **Display**: Full-screen interstitial warning
- **Options**:
  - "Go Back to Safety" (primary action)
  - "Proceed Anyway" (discouraged)
- **Content**: Clear explanation of threat type and severity

### 3. Badge Notifications

- **Visual**: Red badge on extension icon when threat detected
- **Persistent**: Until user navigates away from dangerous site

### 4. Browser Notifications

- **Trigger**: CRITICAL threats only
- **Content**: Brief warning message
- **Action**: Requires user interaction to dismiss

### 5. Form Protection

- **Monitor**: Password/credit card inputs on non-HTTPS sites
- **Action**: Warn before submission
- **Protection**: Prevent data leakage on insecure connections

### 6. Settings/Options Page

- **Controls**:
  - Enable/disable scanning
  - Toggle notification types
  - Choose detection methods
  - Manage whitelist
  - View statistics

## Feature Checklist (Backlog)

This list is intended to be explicit about what Scam Alert should:

- check for
- alert on
- and (where applicable) do quietly in the background

Each item below has a Definition of Done (DoD) to make it measurable and testable.

### A. URL / Address Analysis

1. **Suspicious TLDs**
   - **DoD**:
     - Given a URL with a TLD in the suspicious list, the scan output includes a flagged check explaining why.
     - Given a URL with a common/known-safe TLD, the check does not flag.
     - Unit tests cover at least 5 suspicious and 5 safe examples.

2. **Typosquatting / brand impersonation**
   - **DoD**:
     - Given a URL that is a close misspelling of a protected brand, the scan flags it and explains the match.
     - Known-safe brand domains and known-safe brand-owned TLDs are not incorrectly flagged.
     - Unit tests cover:
       - a true positive typosquat
       - a safe brand-owned domain
       - a near-match that should not trigger

3. **IP address instead of domain**
   - **DoD**:
     - Given a URL that uses an IPv4/IPv6 host, the scan flags it.
     - Local/private IP ranges do not trigger high-severity warnings by default.

4. **Excessive subdomains**
   - **DoD**:
     - Given a URL with more than N subdomain levels (configurable threshold), the scan flags it with a readable explanation.
     - Common patterns that should not be flagged (e.g., typical CDN patterns) are documented and tested.

5. **URL obfuscation** (encoding, misleading characters)
   - **DoD**:
     - Given URLs with percent-encoding, long query strings, or misleading punctuation patterns, the scan flags with a specific reason.
     - A URL with normal encoding usage does not trigger.

6. **Concerning words in the URL**
   - **DoD**:
     - Given URLs containing configured keywords (e.g., "verify", "urgent"), the scan reports the matched words.
     - The UI and Settings text explicitly state this check is URL-only.
     - Tests cover case-insensitivity and common separators (`-`, `_`, `.`, `/`, `?`).

7. **Non-HTTPS (HTTP) connection**
   - **DoD**:
     - Given an `http://` URL, the scan shows a clear "Connection not secure" reason.
     - The severity is not "critical" by default unless combined with additional risk signals.
     - User-facing wording avoids scary labels; it should focus on safe action guidance.

8. **Reputation checks (Google Safe Browsing)**
   - **DoD**:
     - When enabled and API key is configured, a scan includes a detection source entry indicating the API was checked.
     - When disabled or missing API key, the scan clearly indicates the source was skipped (without errors shown to end users).
     - Network failures degrade gracefully and do not break popup rendering.

### B. Page Content Analysis (Future / Optional)

9. **Concerning words in page text**
   - **DoD**:
     - When content scanning is enabled, the system extracts a bounded amount of visible text and scans it locally.
     - The scan output reports matched phrases and where they were found (e.g., page title vs body excerpt) without uploading the page content.
     - Performance: extraction + analysis adds no more than a defined time budget (e.g., 100ms on typical pages).

10. **Form protection signals (password / payment inputs)**
   - **DoD**:
     - Detects the presence of password fields and common payment fields.
     - If the page is non-HTTPS and contains password/payment fields, the scan escalates to a user-visible warning.
     - Does not collect form values, only field type presence.

11. **Mismatched link text vs destination**
   - **DoD**:
     - Finds anchor tags where displayed text suggests a trusted domain but the href points elsewhere.
     - Reports a limited number of examples (bounded) to avoid UI overload.

### C. User Protection / UX

12. **Warning overlay**
   - **DoD**:
     - Overlay appears reliably on threat levels at/above the defined threshold.
     - Overlay has a clear safe default action (go back / close) and a secondary "continue" option.
     - Overlay stays within accessibility guidelines (keyboard, focus trap, readable sizing).

13. **Toolbar icon state**
   - **DoD**:
     - Icon reflects the current tab’s last scan result (green/yellow/red) within 1 second of scan completion.
     - Icon updates correctly when switching tabs and navigating.

14. **Popup transparency** (what was checked)
   - **DoD**:
     - Popup shows which detection sources were run vs skipped.
     - Popup language is friendly by default, with advanced details available.

15. **Whitelist / trusted sites**
   - **DoD**:
     - User can add/remove a site from a whitelist.
     - Whitelisted sites are not blocked/overlaid, but may still be scanned for display purposes (explicit behavior documented).

### D. Settings & Documentation

16. **Expandable help for each option**
   - **DoD**:
     - Each setting has an expandable explanation that explicitly states:
       - what is scanned (URL vs page content)
       - what is sent off-device (if anything)
       - what is stored locally
     - Wording is clear for non-technical users.

## Architecture

### Components

1. **Background Service Worker** (`src/background/`)
   - URL monitoring via `chrome.webNavigation`
   - Orchestrates scanning pipeline
   - Manages notifications and badges
   - Handles message routing

2. **Content Scripts** (`src/content/`)
   - Inject warning overlays
   - Monitor form submissions
   - Detect suspicious page behavior
   - Report findings to service worker

3. **Popup UI** (`src/popup/`)
   - Show current page status
   - Quick access to settings
   - Display recent threats blocked
   - Link to full options

4. **Options Page** (`src/options/`)
   - Detailed settings management
   - Whitelist/blacklist configuration
   - Statistics dashboard
   - Help documentation

5. **Detection Libraries** (`src/lib/`)
   - `detector.js` - Unified detection orchestrator
   - `google-safe-browsing.js` - Google API integration
   - `phishtank.js` - PhishTank integration
   - `pattern-analyzer.js` - Heuristic detection
   - `storage.js` - Chrome storage wrapper
   - `messaging.js` - Inter-component communication

### Architecture (V1 + V2-Ready)

This architecture is designed to ship a strong V1 (URL + reputation scanning) while being ready for optional V2 features (limited page signals like forms/link mismatch) behind explicit privacy gates.

#### Key design principles

1. **URL-first, local-first**
   - Always run local heuristics first.
   - Only call third-party reputation services if the user enabled them.

2. **Minimum data collection**
   - V1 requires only the active tab URL.
   - V2 content signals should be:
     - bounded (limit size)
     - local (do not upload page text)
     - explicit (user-controlled in Settings)

3. **MV3 reliability**
   - Service worker is ephemeral; critical state must be stored in `chrome.storage.local`.
   - All messaging must be resilient to missing receivers.

#### Data flows

##### Flow A: V1 URL scan (default)

```
Tab navigation → Service worker receives URL
  ↓
Normalize URL + check whitelist + cache lookup
  ↓
Pattern Analyzer (local, URL-only)
  ↓
(Optional) Reputation sources in parallel
  - Google Safe Browsing (if enabled)
  - Other sources (must be listed in Privacy section before adding)
  ↓
Combine into a single result (severity + reasons + sources)
  ↓
Persist cache + update icon + update popup state
  ↓
If above thresholds: overlay and/or notification
```

##### Flow B: V2 page signals (optional, privacy-gated)

```
Tab navigation → Service worker requests page signals (if enabled)
  ↓
Content script collects bounded signals
  - presence of password field (yes/no)
  - presence of payment fields (yes/no)
  - limited suspicious link mismatch samples (bounded count)
  - optional bounded text snippets (off by default)
  ↓
Content script sends signals to service worker
  ↓
Detector combines URL-only checks + page signals
  ↓
Severity escalation rules applied (e.g., HTTP + password field → high)
```

#### Severity and alerting rules (guiding policy)

- **Green / SAFE**: No significant concerns
- **Yellow / CAUTION**: Something worth noticing but not necessarily malicious
  - Example: non-HTTPS (HTTP) connection
- **Red / DANGER**: Strong indicators or reputation hits
- **Notifications**: reserved for the highest confidence results to avoid alert fatigue
  - Example policy:
    - URL-only: notify only for critical reputation hits
    - With page signals: notify if a high-risk situation is detected (e.g., HTTP + password field)

#### Permission boundaries

- **webNavigation / tabs**: used for detecting active URL changes and tab context
- **scripting**: injecting content scripts for overlay and (optional) page signals
- **notifications**: used only at high severity thresholds
- **storage**: settings, cache, whitelist, and lightweight stats

V2 features that inspect the DOM must remain:

- strictly optional
- clearly described in Settings
- and implemented with bounded collection

### Data Flow

```
User navigates → webNavigation event → Service Worker
                                            ↓
                                    Should scan URL?
                                            ↓
                        [Pattern Detection] (instant)
                                ↓
                    Critical risk? → YES → Show warning
                                ↓ NO
                        [Offline PhishTank]
                                ↓
                    Known phishing? → YES → Show warning
                                ↓ NO
                    [API Checks in parallel]
                    (Google + PhishTank API)
                                ↓
                        Combine results
                                ↓
                    Threat detected? → YES → Show warning
                                ↓ NO
                            Allow navigation
```

## Permissions Required

- `storage` - Cache results, store settings
- `webNavigation` - Monitor URL changes
- `scripting` - Inject content scripts
- `notifications` - Show system notifications
- `tabs` - Access tab information
- `activeTab` - Interact with current tab

## Success Metrics

1. **Detection Accuracy**
   - False positive rate < 1%
   - True positive rate > 95%

2. **Performance**
   - Average scan time < 500ms
   - No noticeable browsing slowdown

3. **User Experience**
   - Clear, non-technical warnings
   - One-click safety action
   - Minimal disruption for safe sites

## Technical Constraints

1. **Manifest V3 Compliance**
   - Service workers only (no background pages)
   - Ephemeral state management
   - Async message handling with error handling

2. **Code Quality**
   - Max 500 lines per file
   - 80%+ test coverage
   - JSDoc documentation

3. **API Rate Limits**
   - Google Safe Browsing: 10k/day (free)
   - PhishTank: Use offline mode primarily
   - Implement caching (24hr TTL)

## Out of Scope (V1)

- ❌ Family notification system
- ❌ Cloud sync across devices
- ❌ Mobile app version
- ❌ Machine learning model training
- ❌ Commercial threat intelligence feeds

## Future Considerations (V2+)

- Multi-browser support (Safari, Firefox)
- Advanced ML-based detection
- Family dashboard with alerts
- Crowdsourced threat reporting
- Enterprise/MSP features

## Privacy & Security

### Privacy / Data Handling

This section is intended to be plain and explicit.

1. **What Scam Alert reads**
   - The website address (URL) of the active tab when scanning.
   - Basic scan signals produced by the extension’s own logic (e.g., "non-HTTPS", "suspicious TLD").
   - If optional content scanning features are enabled in the future, Scam Alert may read limited page signals (e.g., presence of a password field) as described in the Settings.

2. **What Scam Alert does NOT read**
   - It does not read or store typed passwords.
   - It does not read or store form field values.
   - It does not record a full browsing history timeline.

3. **What Scam Alert stores locally**
   - User settings (feature toggles, API key presence, preferences).
   - Short-lived scan cache entries for performance (implementation-defined TTL).
   - Optional statistics counters (e.g., number of warnings shown), if enabled.

4. **What Scam Alert sends off-device (third-party services)**
   - **Google Safe Browsing (optional)**: sends the current page URL as part of a reputation query when enabled.
   - Other services must be explicitly listed here before being added.

5. **Data minimization principles**
   - Prefer local/offline checks first.
   - Only send data to third parties when the user has enabled that specific feature.
   - Never transmit page text/content unless explicitly enabled and documented.

## Build Plan (Phased)

This plan is structured to deliver immediate safety value while minimizing false alarms and keeping privacy expectations clear.

### Phase 0: Baseline quality + correctness (stabilization)

- Scope:
  - Verify scan cache behavior (TTL, invalidation on update)
  - Verify popup rendering never breaks on missing data / API errors
  - Confirm messaging resilience (no noisy console errors for missing receivers)
- Exit criteria:
  - Manual test pass on 10 common sites + 3 test-mode scenarios
  - No unhandled promise rejections in service worker logs during typical browsing

### Phase 1: V1 URL-first protection improvements

- Scope:
  - Add **non-HTTPS (HTTP) detection** (yellow/caution by default)
  - Confirm severity mapping + icon/popup language stays elderly-friendly
  - Ensure Settings and popup transparency remain explicit (URL-only keyword scanning)
- Exit criteria:
  - Visiting an `http://` site produces a clear caution message in popup
  - Does not generate high-severity overlays/notifications by itself
  - Unit tests added for protocol parsing + severity mapping

#### Phase 1: Definition of Done (HTTP / non-HTTPS detection)

This is the concrete DoD used to decide whether Phase 1 is “done”.

##### A. Detection rules

- Given a navigated URL that starts with `http://`:
  - The scan result includes a dedicated check/reason indicating the connection is not encrypted.
- Given a navigated URL that starts with `https://`:
  - The HTTP/non-HTTPS check does not flag.
- Given internal pages (e.g., `chrome://`, `chrome-extension://`):
  - The scan is skipped as it is today.

##### B. Severity policy

- HTTP alone maps to **CAUTION / yellow** (not “danger”).
- HTTP alone must not trigger:
  - a full-page warning overlay
  - a system notification
- HTTP may contribute to a higher severity only when combined with other strong signals (examples):
  - reputation hit from Google Safe Browsing
  - strong URL heuristic score
  - (future) form signals like password field present

##### C. Elderly-friendly user-facing wording (final copy)

The wording must be calm, clear, and action-oriented.

- **Popup headline/status (suggested)**: "Connection not secure"
- **Popup short explanation**: "This website is using an unencrypted connection (HTTP). Avoid entering passwords or payment information here."
- **Advanced details label**: "Non-secure connection (HTTP)"
- **Do not use** terms like "Fraud" or "Deceptive" for this signal.

If we need an even softer version, use:

- "This site is not using a secure connection. It may be okay for reading, but avoid signing in or paying here."

##### D. Icon behavior

- On `http://` pages (and only due to HTTP): icon is **yellow**.
- On `https://` pages with no other concerns: icon is **green**.
- Switching tabs updates icon to match that tab’s last scan.

##### E. Notification + overlay policy

- No overlay or notification may be shown for HTTP alone.
- Overlay and notification rules remain governed by the existing severity thresholds.

##### F. Transparency / Settings alignment

- Settings help text remains accurate (explicitly URL-only keyword scanning).
- Popup "What did we check for?" includes (or can include) an item for "Connection security (HTTP/HTTPS)" if shown to users.

##### G. Test cases (manual)

- Visit a known HTTP site:
  - Expected: popup shows "Connection not secure" messaging
  - Expected: icon yellow
  - Expected: no system notification
  - Expected: no full-page overlay
- Visit a known HTTPS site:
  - Expected: no HTTP caution reason
  - Expected: icon green (assuming no other issues)
- Navigate between HTTP and HTTPS pages across 3 tabs:
  - Expected: icon correctly reflects active tab

##### H. Test cases (unit)

- `pattern-analyzer` / protocol detector:
  - `http://example.com` → flags non-HTTPS
  - `https://example.com` → does not flag
  - `HTTP://example.com` (mixed case) → flags non-HTTPS (case-insensitive)
- severity mapping:
  - HTTP alone returns CAUTION/yellow severity
  - HTTP + (simulated) critical reputation hit returns higher severity than HTTP alone

### Phase 2: Alerting policy tuning (avoid fatigue)

- Scope:
  - Define and document alert thresholds:
    - overlay threshold
    - notification threshold
  - Add a setting to control HTTP warning behavior (popup-only vs optional notification)
- Exit criteria:
  - Notifications occur only for high-confidence scenarios
  - User can explain "why did I get notified" from popup transparency
  - Optional HTTP notification toggle defaults off and respects main notification setting

### Phase 3: V2 privacy-gated page signals (optional)

- Scope (off by default unless you prefer otherwise):
  - Content script collects **bounded** signals:
    - password field present (boolean)
    - payment field present (boolean)
    - limited samples of link-text vs href mismatch
  - No collection of typed values
  - No uploading of page text
- Exit criteria:
  - If enabled, HTTP + password/payment signals escalate severity
  - Clear Settings text and PRD Privacy section remain accurate
  - Performance budget met (bounded DOM scanning)

### Phase 4: Optional content keyword scanning (advanced, privacy-sensitive)

- Scope:
  - If enabled, scan **bounded snippets** (title + limited visible text)
  - Provide "why highlighted" explanations locally
- Exit criteria:
  - Explicit opt-in setting
  - No page text sent to third parties
  - Clear UI controls to disable

### Phase 5: Reporting + user support (future)

- Scope:
  - "Report this site" UX (destination and privacy reviewed before implementation)
  - Lightweight scan history (local-only)
- Exit criteria:
  - Clear data handling disclosure for any report feature
  - User can review what would be shared before sending

## Deployment

- **Distribution**: Chrome Web Store
- **Updates**: Automatic via Chrome Web Store
- **Development**: NAS sync for team collaboration
- **Testing**: Local unpacked extension during dev

---

**Version**: 1.0.0  
**Last Updated**: 2026-01-20  
**Status**: In Development
