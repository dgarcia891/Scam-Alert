# Form Intercept Technical Roadmap (v1.0)

Form interception is the "moat" feature that warns users at the moment of action (submission).

## 1. Overview

Instead of blocking entire pages, form interception monitors for sensitive inputs (passwords, credit cards) and soft-blocks submission on suspicious origins.

## 2. Detection Logic

- **Triggers**:
  - `form.addEventListener('submit')`
  - `button.click()` where button type is `submit`
- **Sensitive Inputs**:
  - `input[type="password"]`
  - `input[name*="cvv"]`, `input[name*="card"]`
  - Heuristic detection for social security numbers.

## 3. UI/UX Specifications

- **Location**: In-place banner above the form OR a centered modal.
- **Tone**: "Wait! Are you sure?" (consistent with `docs/COPY.md`).
- **Friction**:
  - Primary Action: "Stop & Review" (closes warning, focuses input).
  - Secondary Action: "Send Anyway" (small, 3-second delay).

## 4. Technical Implementation

- **Content Script**: Performs the DOM monitoring.
- **Background**: Provides the security lookup (cached scan results).
- **Communication Flow**:
  1. Content script detects submit.
  2. Request `GET_SCAN_RESULTS` for current domain.
  3. If severity >= `MEDIUM`, prevent default.
  4. Inject warning UI.

## 5. Security Edge Cases

- **SPAs**: Listen for `fetch` or `XHR` to sensitive-looking endpoints.
- **Shadow DOM**: Ensure input monitoring traverses shadow roots.
- **Cross-Origin Iframes**: Permission-based monitoring for credit card fields in iframes.
