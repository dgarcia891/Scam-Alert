# Bug Log

| ID | Status | Severity | Description | Fix |
| :--- | :--- | :--- | :--- | :--- |
| BUG-000 | CLOSED | Low | System Initialization | - |
| BUG-001 | CLOSED | High | UI changes not visible in browser | Migrated logic from legacy `src/popup` to active `src/ui` (React) and fixed manifest paths. |
| BUG-002 | CLOSED | Medium | Report Scam Modal fails "detection script not loaded" | Added `OPEN_REPORT_MODAL` handler and generic `showReportModal` function to `content-main.js`. |
| BUG-037 | CLOSED | High | Runtime Error (No tab with id / Unknown Message) | Added `sendResponse` to default case in Content Script and wrapped `chrome.action` calls in try-catch in Service Worker. |
| BUG-053 | CLOSED | Medium | Extension Version Sync Failure (dist/ lag) | Added `npm run build` to `deploy.md` workflow and refactored `vite.config.js` to use absolute paths for manifest sync. |
| BUG-054 | CLOSED | High | Recurring "No tab with id" errors in service worker | Added "No tab with id" error message to graceful handling in `sendMessageToTab` function. Created regression test to prevent recurrence. |
| BUG-055 | CLOSED | High | Ghost Badge Discrepancy (Badge shows but Popup says Secure) | Fixed `tabId` retrieval in `popup.jsx` and added "Risk Indicators" section to explain warnings. Explicitly cleared badge for SAFE sites in SW. |
| BUG-056 | CLOSED | High | Uncaught (in promise) Error: No tab with id | Awaited `chrome.action` badge calls and wrapped them in `try-catch` with `ignoreTabError` in `icon-manager.js`. |
| BUG-057 | CLOSED | High | Ghost Badge Discrepancy (Badge shows warning but popup shows "No Threats Detected") | Added "message port closed" to graceful error handling in `messaging.js`. Synced scan results to `tabStateManager` in `service-worker.js` so badge and popup read from same data source. |
| BUG-058 | CLOSED | High | Uncaught (in promise) Error: No tab with id (in handleThreat) | Added `await` keywords to `chrome.action.setBadgeText` and `setBadgeBackgroundColor` calls in `handleThreat` function in `service-worker.js`. Created regression test BUG-058.test.js. |
| BUG-059 | CLOSED | High | Ghost Badge Discrepancy (Yellow exclamation but no info in popup) | Updated `syncIconForTabFromCache` in `icon-manager.js` to sync cached results to `tabStateManager`. Passed the manager through the navigation handler context in `service-worker.js`. |
| BUG-060 | CLOSED | Medium | Popup UI is cluttered and "unfriendly" for seniors | Refactored `popup.jsx` for calm SAFE state (neutral slate), softened CAUTION copy ("Take a moment"), reordered accordion (reasons-first), and implemented robust navigation fallback. |
| BUG-061 | CLOSED | High | Dashboard/Logs links in popup lead to 404 error | Updated `handleOpenTab` in `popup.jsx` to correctly target integrated options page with URL hashes (`#logs`, `#settings`). |
| BUG-062 | CLOSED | Medium | Yellow exclamation badge flashes briefly on navigation | Updated `navigation-handler.js` to clear badge state immediately on navigation. Aligned `service-worker.js` and `icon-manager.js` to treat `LOW` severity as `SAFE` for badge purposes. |
| BUG-063 | CLOSED | Medium | Ghost Badge Discrepancy ("!" badge shows for LOW severity while Popup is SAFE) | Prevented LOW severity items from triggering `handleThreat` inside `scanAndHandle` in the service worker. |
| BUG-065 | CLOSED | High | Ghost Badge on Safe Sites (Single soft signal triggering MEDIUM severity) | Fixed `determineSeverity` in `scoring.js` to return `LOW` for any single soft signal. Only 2+ soft signals escalate to `MEDIUM`. |
| BUG-066 | CLOSED | High | Ghost Badge on every page (overallSeverity field mismatch) | Modified `createScanResult` in `scan-schema.js` to correctly expose `overallSeverity` and `overallThreat` fields, ensuring proper badge logic. |
| BUG-067 | CLOSED | Low | Detection Result box is always red in Modal | Modified `src/ui/options/options.jsx` to make the "Detection Result" box color conditional on severity (Emerald for SAFE/LOW/NONE). |
| BUG-068 | CLOSED | Critical | Authority impersonation gift card scam not detected | Expanded `email-heuristics.js` with: religious/org authority titles (father/pastor/priest), 'get reimbursed', 'done today', and authority pressure + secrecy language pattern. |
| BUG-069 | CLOSED | Medium | Icon is solid green square & Email scam not triggered | Fixed icon tinting in `icon-manager.js` by using `multiply` blend mode to preserve detail. Fixed email scan trigger in `email-scanner.js` by including `isEmailView: true` and sender data in the payload. |
| BUG-070 | CLOSED | Critical | Scam email still not triggering Red icon/Overlay | Resolved logic gap in `detector.js` where `emailScams` and `urgencySignals` results from `analyzeUrl` were being ignored for global severity calculation. |
| BUG-071 | CLOSED | Critical | Email Scanner dead (Uncaught ReferenceError) | Fixed `ReferenceError: parseSenderInfo is not defined` in `email-scanner.js` by adding the missing import from `../lib/scanner/parser.js`. |
| BUG-072 | CLOSED | Medium | Overlay "Reason" button is not interactive | Added clickable expansion to the "Reason" button in `content.js`, revealing a technical details panel populated from `result.checks`. Refactored `content.js` for testability. |
| BUG-075 | CLOSED | Medium | 'Go back to safety' button does nothing | Added robust fallback navigation using setTimeout and `window.location.href='about:blank'` for tabs lacking history in `content.js`. |
| BUG-076 | CLOSED | High | Previously flagged sites appearing SAFE due to cache regression | Added backwards compatibility to `getCachedScan` in `storage.js` to normalize deprecated `severity` fields to `overallSeverity`, preventing silent `SAFE` evaluation in UI elements. |
| BUG-078 | CLOSED | Critical | Scam email bypassed detection (false negative) | Expanded `email-heuristics` with structured regex to scan forwarded headers for official impersonations, and added implicit commands ("do with them", "let me know") to the gift card command array. |
| BUG-079 | CLOSED | Medium | Popup claimed "Email heuristics" ran when they didn't | Removed hardcoded webmail URL assumption in `popup.jsx`; UI now strictly renders the check text only if `scanResults.checks.emailScams` explicitly exists in the dataset. |
| BUG-080 | CLOSED | High | Overlay resets on "Reason" click & Popup shows SAFE despite RED badge | Added `e.stopPropagation()` to overlay container to block Gmail DOM mutations. Added MV3 SW cache fallback to `handler.js` so ephemeral state loss correctly fetches persistent data rather than defaulting to `SAFE`. |
| BUG-081 | CLOSED | Medium | "Go back to safety" button just does an about:blank tab | Increased fallback timeout to 500ms in `content.js` and implemented background-proxied `NAVIGATE_BACK` using `chrome.tabs.goBack` for maximum reliability. |
| BUG-082 | CLOSED | Medium | SPA Back Navigation Fallback (Gmail) | Updated `content.js` to await the `NAVIGATE_BACK` response, clear the fallback timeout upon success, and natively remove the overlay from the DOM to expose the restored SPA state. |
| BUG-083 | CLOSED | High | False Negative: "Nostalgic Photos" email with suspicious URL | Added `checkSuspiciousPort` to `url-engine.js` (flags non-standard ports like `:8443`) and a Vague Lure heuristic to `email-heuristics.js` (flags "nostalgic/photos" lures combined with external links). |
| BUG-084 | CLOSED | High | "More Info" button on red overlay causes page refresh and overlay reset | `mutation-observer.js` was observing all DOM changes; clicking "More Info" caused a layout reflow, triggering a rescan which reset the overlay. Added an overlay-presence guard (`document.getElementById(OVERLAY_ID)`) to `mutation-observer.js` to suppress rescans while overlay is visible. |
| BUG-084 | CLOSED | High | Unit test regressions after SPA fix | Resolved event propagation issues in `content.js` and fixed `content.test.js` to handle Shadow DOM and ESM modules. |
| BUG-085 | CLOSED | High | Failed to load extension (Missing assets) | Updated source `manifest.json` with `dist/` prefixes and added build-time transformation to `vite.config.js`. |
| BUG-089 | CLOSED | Medium | Recurring warnings after selecting "I understand the risks" | Implemented session-level acknowledgement tracking in `content.js`. |
| BUG-090 | CLOSED | Critical | Hydra Guard Rebrand | Rebranded "Scam Alert" to "Hydra Guard" across all surfaces (UI, Metadata, Technical IDs, Docs). Verified via comprehensive audit and updated test suite. |
| FEAT-086 | CLOSED | Enhancement | Visual DOM Highlighting & Tooltips | Implemented `highlighter.js` to visually mark scam triggers on the page with red dashed borders. Added hover tooltips explaining the category/reason for each detection. Enriched Phrase and Email engines with a new `visualIndicators` field. |
| FEAT-077 | OPEN | Enhancement | Email Reputation API Integration (e.g., EmailRep.io) to check sender history, domain age, and disposable status. | - |
| BUG-087 | CLOSED | Medium | Highlighting tooltip blinking and color mismatch | Changed highlight color to deep vibrant red (`#dc2626`). Fixed blinking by adding a `_showTooltip` guard (preventing redundant re-renders on the same element) and increasing the vertical offset from 10px to 14px. |
| BUG-088 | CLOSED | Low | HIDE_WARNING message not logged | Added `console.log` to `HIDE_WARNING` case in `content.js` to log when the message is received and when the overlay is removed. |
| BUG-091 | CLOSED | High | Email scanner missing vague lures (e.g. "Re: PHOTOS") | Added `extractEmailLinks` to `parser.js` and injected `links` array into `pageContent` in `email-scanner.js`. Expanded `vagueLureKeywords` in `email-heuristics.js` to catch "those pics" and similar phrases. |
| BUG-092 | CLOSED | Medium | Settings page returns ERR_FILE_NOT_FOUND from Popup | Updated `handleOpenTab` in `popup.jsx` to dynamically fetch the production path via `chrome.runtime.getManifest().options_page` rather than hardcoding `options/index.html`. |
| BUG-093 | CLOSED | High | Overlay pops up again across page reloads/redirects after "Proceed anyway" | Handled state loss of `warningAcknowledged` across same-origin navigations by persisting the boolean flag into `window.sessionStorage` inside `content.js`. |
| BUG-094 | CLOSED | High | AI Second Opinion lacks full email context | Refactored `extractEmailContext` in `ai-verifier.js` and updated `detector.js` to ensure background auto-scans pass rich email data to Gemini. |
| BUG-095 | CLOSED | High | AI Second Opinion context still empty (`[]`) for automated scans | Fixed `service-worker.js` overwriting sender email with name. Added `metadata` to `ScanResult` schema in `scan-schema.js`. Passed metadata in `detector.js` down to cache. |
| BUG-096 | CLOSED | Critical | AI prompt receives no email data — wrong Gmail DOM selectors | Fixed `parseSenderInfo()` to use `.gD[email]` attribute instead of non-existent `.go`. Added `extractSubject()` using `.hP`. Updated `email-scanner.js` to pass subject and added diagnostic logging. |
| BUG-097 | CLOSED | Critical | Manual "AI Second Opinion" receives no email context | Dashboard used `extractEmailData()` from `extraction-logic.js` (outdated selectors) instead of proven `parser.js` functions. Switched to `parseSenderInfo()`, `extractEmailText()`, `extractSubject()` from `parser.js`. Updated `handler.js` to accept real-time context from message payload. |
| BUG-098 | CLOSED | High | Manual "AI Second Opinion" receives no context variables (phrases, intent keywords) | Extracted `intentKeywords` and `phrases` from the cached scan results in `handler.js` and correctly mapped them to the `verifyWithAI` payload. |
| BUG-099 | CLOSED | High | Service Worker crash on install/reload (ReferenceError) | Fixed `onInstalled` handler in `lifecycle.js` which called undefined `scanActiveTabs()` instead of the provided callback `scanActiveTabsCb`. |
| BUG-100 | CLOSED | High | Manual "Ask AI" in popup receives empty context on Gmail | Updated `popup.jsx` to pass `tabId` and `handler.js` to retrieve live scan results from `tabStateManager`. Implemented "Insufficient Context" guard to prevent "Looks safe" false positives when data is missing. |
| BUG-101 | CLOSED | High | "Analyzing with AI..." stuck permanently | Fixed missing `currentTabId` in React `useCallback` dependency array in `popup.jsx` preventing correct context relay. Added `AbortSignal.timeout(10000)` to Gemini `fetch` call in `ai-verifier.js` to guarantee no hanging promises. |
| BUG-102 | CLOSED | High | "Analyzing with AI..." still stuck due to ReferenceError | Fixed missing `currentTabId` prop pass-through to `<AskAIButton>` in `popup.jsx`. The previous `useCallback` fix caused a silent React crash because `currentTabId` was undefined in the component scope. |
| BUG-103 | CLOSED | Medium | Empty context triggers "Looks off" but the user cannot see why the extraction failed | Wrapped `GET_EMAIL_CONTEXT` string parsing logic in `email-scanner.js` with `try...catch`. Injected explicit `fetchError` states and raw parsed arrays into the `_debug` field of the Empty Context Guard in `handler.js` so users can inspect silent failures. |
| BUG-104 | CLOSED | High | Deep analysis reveals UI sends nothing to AI due to triple-failure | Fixed `tabState.results` lookup mismatch (changed to `scanResults`). Fixed premature JS message channel closure in `email-scanner.js` (`return true`). Adjusted Empty Context Fallback to detect "all empty string" objects. |
| BUG-105 | CLOSED | High | "ReferenceError: fetchError is not defined" in ASK_AI_OPINION | Fixed scoping issue in `handler.js` where `fetchError` was declared inside an `else` block but accessed globally. Moved declaration to outer function scope. |
| BUG-106 | CLOSED | Critical | "Unknown message type" — `content.js` intercepts `GET_EMAIL_CONTEXT` before `emailScanner.js` | The general `content.js` `default` switch case was actively rejecting all unrecognized messages with `sendResponse({ error: 'Unknown message type' })`. Since Chrome delivers `tabs.sendMessage` to ALL content scripts and uses the first response, `content.js` always won the race. Changed `default` to `return false` so it doesn't respond to messages intended for other scripts. |
| BUG-107 | CLOSED | Medium | Manual AI verifications disappear from popup after navigating away | `MutationObserver` triggers `forceRefresh: true` on tab loads. This caused `scanAndHandle` in `service-worker.js` to completely bypass cache and overwrite it with a fresh scan, destroying the `aiVerification` object. Fixed by salvaging `aiVerification` from existing cache and re-injecting it into the new scan results. |
| BUG-109 | CLOSED | Low | Blank Sender Email in AI Prompt | The manual AI context fetcher was packing name and email into a single string for `senderName` while leaving `senderEmail` blank. Fixed by passing both fields separately from `email-scanner.js` and mapping them individually in `handler.js`. |
| BUG-118 | CLOSED | High | AI "Context Guard Triggered" on Gmail spam emails — content script unreachable | `GET_EMAIL_CONTEXT` message to content script fails with "Receiving end does not exist" because Gmail is a SPA and the email scanner content script may not survive navigation or service worker restarts. Fixed by adding a programmatic re-injection fallback via `chrome.scripting.executeScript` in `handler.js` — when the initial message fails, the handler re-injects `emailScanner.js` and retries once. |
| BUG-119 | CLOSED | High | AI Second Opinion "Submitting..." stuck permanently | The `AskAIButton` component in `popup.jsx` was referencing `scanResults` which was never passed as a prop from the main `Popup` component, causing a silent `ReferenceError` when the submit button was clicked. Fixed by passing `scanResults` to all `AskAIButton` instantiations. |
| BUG-120 | CLOSED | Medium | Extension completely ignores Roundcube Webmail instances | The heuristic checks in `detector.js`, `popup.jsx`, `ai-verifier.js`, and `extraction-logic.js` were hardcoded to Gmail, Outlook, and Yahoo. Roundcube instances (often on cPanel) were missed. Fixed by adding `roundcube` to the heuristic URL/Host checks and adding DOM extraction capabilities for Roundcube's `messagecontframe` iframe. |
| BUG-121 | CLOSED | High | Extension is unable to scan Roundcube Webmail correctly (empty context) | In `extraction-logic.js`, the query selector for sender and subject was restricted to the `iframe` document when `iframeExtraction` was true. However, for Roundcube, the sender and subject are located in the main document. Fixed by changing the querying logic to check `document` first before falling back to `doc` (the iframe). |
| BUG-122 | FIXED | High | AI "Context Guard Triggered" — popup Ask AI fails to extract email context | `ai-handler.js` was querying `chrome.tabs.query` instead of using the `tabId` from the popup message, and used raw `chrome.tabs.sendMessage` instead of the robust `sendMessageToTab` wrapper. Fixed by prioritizing `msgData.tabId` and switching to `sendMessageToTab`. Regression test: `redirect-chain.test.js`. |
| BUG-123 | FIXED | Critical | Multi-domain redirect chain phishing links not detected in emails | Phishing buttons with URLs containing many `@` symbols and domain-like path segments (e.g., `.co.uk`, `.net`, `.com`) were not caught. Added `checkRedirectChain` to `url-engine.js` and wired it into `email-heuristics.js`. Regression test: `redirect-chain.test.js`. |
| BUG-124 | FIXED | High | ReferenceError: document is not defined in serviceWorker.js | `ai-handler.js` used an arrow function `() => document.body.innerText...` as the `func` argument to `chrome.scripting.executeScript`. Vite/Rollup captures the closure at bundle time in the SW scope where `document` is undefined. Fixed by changing to a named `function` declaration so Rollup serializes it correctly for execution in the tab context. |
| BUG-125 | FIXED | High | Gmail spam/search folder email body not extracted — Context Guard triggers on clearly phishing email | In Gmail's spam/filter/search reading pane, email bodies render inside `.adn.ads .a3s` containers, not `.a3s.aiL`. The extension's selector list in `parser.js` and `email-clients.js` was missing these spam-pane-specific selectors. Also improved AI handler fallback to try email body selectors before raw `document.body.innerText`. |
| BUG-127 | FIXED | Critical | Auto-scan not triggering in Gmail spam/search view | Added retry logic (3 attempts) and initial scan trigger 1.5s after load to capture lazy-loaded content. |
| BUG-128 | FIXED | High | AI Verification Result UI Mismatch | Enhanced `validateAIResponse` parsing robustness (trailing commas/extra text) and synced `reason`/`details` fields across background and popup. Corrected `CONFIRMED` verdict labeling and color mapping. |
| BUG-129 | FIXED | Critical | Email heuristic scan not running on Gmail | `FORCE_RESCAN` and `webNavigation` scans didn't pass `pageContent`, so email heuristics never ran. Enhanced `handleForceRescan` to fetch live email context from the content script. Fixed popup race condition where a `setTimeout` re-fetch overwrote enriched results with stale URL-only data. |
| BUG-130 | FIXED | High | Gmail plain-text or missing-.a3s spam emails return empty content | Added `.ii.gt`, `.nH.hx .a3s`, and `[dir="auto"]` fallbacks to `extractEmailText()` in `parser.js`. Updated `email-clients.js` to match. |
| BUG-131 | FIXED | Critical | False 'Safe' UI and silent failure when email content extraction fails | Upgraded linear extraction retries to exponential backoff (up to 15s) in `email-scanner.js`. Handled `extractionFailed` signal in `service-worker.js` by emitting `UNKNOWN` severity and an amber '?' badge instead of a URL-only scan. Fixed popup to show "Scanning email..." and auto-rescan instead of defaulting to "You're safe" for email clients without content. |
| BUG-132 | FIXED | Critical | Still no extraction and no proactive notification | Added `isEmailReadingView()` guard to prevent premature 1.5s timeout retries from exhausting against the inbox list instead of waiting for the actual email mutation. Also added a `chrome.notifications.create` proactive system alert when the `UNKNOWN` (extraction failed) severity is emitted to ensure the user is warned. |
| BUG-133 | FIXED | Critical | Email extraction fails because Gmail SPA navigations don't trigger the content script | Added a lightweight 500ms URL polling loop in `email-scanner.js` and a `chrome.webNavigation.onHistoryStateUpdated` listener in `service-worker.js`. Together, these two layers detect when the user opens an email via Gmail's internal React router (`pushState`) and re-trigger the extraction scan with fresh retries. |
| BUG-134 | FIXED | High | False positive on YouTube URLs due to excessive hex-encoding in query parameters | Refactored `urlObfuscation` engine to restrict `%` checks to the origin+pathname, and `@` checks to domain-auth. Added dynamic regex override engine via Supabase. Regression test: `BUG-134.test.js`. |
| BUG-135 | FIXED | High | `ReferenceError: document is not defined` in serviceWorker.js — AI Second Opinion crashes | Vite's `modulepreload` polyfill injects `document.getElementsByTagName` and `document.createElement` into the service worker bundle. Service workers have no DOM. Fixed by adding a post-build strip script (`strip-sw-polyfill.cjs`) and `modulePreload: { polyfill: false }` to `vite.config.js`. Regression test: `BUG-135.test.js`. |
| BUG-136 | FIXED | High | Gmail spam/search/trash folder email extraction fails — 0 pipeline checks run | `isEmailReadingView()` guard in `email-scanner.js` did not recognize Gmail's spam reading pane container (`.adn.ads`). The 1.5s initial scan fired, guard returned `false`, scan aborted. Fixed by adding `.adn.ads`, `.adn.nH.ads`, `.aeF` selectors and URL hash detection (`/#spam/, /#search/, /#trash/`) to `isEmailReadingView()`. Regression test: `BUG-136.test.js`. |
| BUG-137 | FIXED | Critical | Gmail spam email body extraction returns empty — all CSS selectors miss + dist/manifest.json not rebuilt | Two root causes: (1) `dist/manifest.json` was v1.0.208 while source was v1.0.211 — the user's extension never loaded the BUG-136 fix. (2) `extractEmailText()` had no fallback when all CSS selectors miss. Fixed by adding a Gmail-specific programmatic fallback to `parser.js` that walks `.nH.hx` / `.aeF` reading pane for the largest text block. Also rebuilt dist/ with correct version. Regression test: `BUG-137.test.js`. |
| BUG-138 | FIXED | High | Gmail extraction returns empty body on Force Rescan — heuristics silently skip | Extracted `fetchEmailContextWithRetry` helper in `handler.js` using a 3-attempt exponential backoff. Added `bodyReady` boolean to `GET_EMAIL_CONTEXT` so `handler.js` can distinguish missing body from actual failures. Emit amber badge during backoff retries to mitigate false security gap. Regression test: `BUG-138.test.js`. |
| BUG-142 | CLOSED | Critical | Email Scanning Completely Dead — Global Safe List Whitelist Bypass | Added `isEmailScan` check to bypass URL whitelist for emails. |
| BUG-145 | CLOSED | Critical | Missing Email Extractors Trigger Premature Target Timeout | Added `<area>` support, decoupled `isLoaded` from text length, and added structural fallbacks. |
| BUG-146 | CLOSED | High | [Hydra Guard] Infinite Loading on Email Scans | Wrapped `scanAndHandle` in `finally` to ensure `scanInProgress` reset and removed manual rescan locks. |
| BUG-147 | CLOSED | High | "Analyzing Safety" UI hang on extraction failure | Hoisted `result` to outer scope, added explicit `catch` broadcast, and implemented `broadcastSent` logic in `finally` for guaranteed signal delivery. |
## BUG-139: "Analyzing with AI..." Spinner Stuck Permanently
**Date:** 2026-03-30
**Status:** Resolved
**Description:** Clicking "Ask AI for a second opinion" caused the spinner to hang indefinitely without timeout.
**Root Cause:**
1. A `ReferenceError` on `type` in the global `service-worker.js` message listener `.catch()` block crashed the unhandled rejection handler, preventing `sendResponse` from being called and leaving Chrome ports open until GC.
2. The popup `AskAIButton` implementation lacked a client-side timeout, offering no fallback when the background hung.
**Workaround/Fix:**
- Updated the SW `.catch()` to safely reference `message?.type` instead of the destructured (and out-of-scope) `type`.
- Implemented a 30-second `setTimeout` in the popup with request ID correlation (`useRef`) to cleanly abort and display a timeout error without race conditions.
**Lessons Learned:**
Uncaught promise rejections in global message handlers are dangerous because an error *in the crash handler itself* silently swallows `sendResponse`. Always ensure `chrome.runtime.sendMessage` calls have client-side timeouts (defense-in-depth) when user UI is waiting on background operations.
## BUG-140: Empty-Body Emails Silence Scanner Metadata
**Date:** 2026-03-30
**Status:** Resolved
**Description:** Emails possessing no physical body text (e.g. Google DMARC reports or image-only spam) returned `< 20` chars during `extractEmailText()`. This mistakenly tripped the lazy-load safeguard, causing the scanner to retry 5 times and eventually drop the scan completely without extracting perfectly valid sender and subject information physically present in the DOM.
**Root Cause:**
`triggerScan()` failed to evaluate sender/subject properties before firing the empty-body retry loop. Thus, valid emails without body text dropped through the heuristic safety net entirely.
**Workaround/Fix:**
Updated `email-scanner.js` to unconditionally extract all fields `(body, sender, subject, headers, links)` at the start of the cycle. Re-defined the `isLoaded` criteria to be true if **ANY** of `{data, senderInfo.email, subject}` are populated. Added `BUG-140.test.js` to verify.
**Lessons Learned:**
Heuristic pipeline orchestration must be designed defensively around the limits of DOM extraction. A missing field (body) shouldn't abort the pipeline if other critical fields (sender, subject) successfully resolved.

## BUG-141: AI Background Fetch Timeout UI Hanging

**Date:** 2026-03-30
**Status:** Resolved (v2 — full fix)

**Description:** Clicking "Ask AI for a second opinion" on any page (especially Gmail) caused the popup to hang for 30 seconds and display "AI unavailable" with no real diagnostic information. The Gemini API call appeared to never return.

**Root Cause (v1 — partial, cosmetic):**
The initial investigation focused on `verifyWithAI()` relying on `AbortSignal.timeout(10000)` which is unreliable in MV3 Service Workers. An `AbortController` with manual `setTimeout` was added, but this only hardened ONE sub-step of a multi-step operation.

**Root Cause (v2 — real problem):**
The `handleAskAIOpinion` function is a chain of 5+ async operations: `getSettings()` → `getCachedScan()` → content script context fetch (with potential re-injection and retry) → `verifyWithAI()` → `cacheScan()`. ANY of these steps could hang independently, and there was no operation-level timeout wrapping the entire chain. If the total wall time exceeded the popup's 30s `sendResponse` timer, the Chrome message port expired silently and the popup never received a response — showing "AI unavailable" with no diagnostic ability. The `verifyWithAI` 15s timeout only protected one sub-step.

Additionally, the auto-scan pipeline stage "5. AI SECOND OPINION" showing "PASS" was misleading — the auto-scan SKIPS AI entirely for SAFE/LOW severity pages (detector.js line 219-220). The "PASS" label meant the stage completed (by being skipped), not that the API was verified working. This masked the fact that the Gemini API connection had never been validated for the current session.

**Fix:**

1. Wrapped the entire `handleAskAIOpinion` operation in a hard 20s `Promise.race` timeout at the handler level (`OPERATION_TIMEOUT_MS = 20000`). This guarantees the popup ALWAYS receives a real `sendResponse` callback (with diagnostic debug data) before its own 30s safety timer fires — regardless of which internal sub-step hangs.
2. Added diagnostic `console.log` at every major step (settings fetch, context fetch, Gemini call, response) so future hangs can be traced in `chrome://extensions` → Inspect views → service worker.
3. Updated popup display to show "AI: Could not determine" for INCONCLUSIVE verdicts instead of the misleading "Something looks off".
4. Retained the v1 fixes: AbortController in verifyWithAI, TIMEOUT_VERDICT, cache-gating for timeouts.

**Lessons Learned:**
When a user-facing operation depends on a chain of N async steps, each with its own timeout, the total wall time is the SUM of all timeouts plus overhead — not the max. A single step-level timeout (e.g., 15s on fetch) is insufficient if the operation has 5 steps that can each add latency. The operation level (the function called by `sendResponse`) MUST have its own hard ceiling timeout that is always well under the UI's deadline. Defense-in-depth means timeouts at EVERY layer: individual step, whole operation, and UI fallback.

## BUG-142: Email Scanning Completely Dead — Global Safe List Whitelist Bypass

**Date:** 2026-03-30
**Status:** Resolved (v1.0.218)
**Severity:** Critical

**Description:** The popup shows "NO SCAN / 0 checks run" on ALL Gmail emails. Sender, Subject, and Body fields are all blank. The extension appears to load correctly (version visible in popup) but never processes any email content.

**Initial Hypothesis (v1.0.217 — INCORRECT):**
The `isEmailReadingView()` function in `email-scanner.js` contained a broken regex (`/\/#.../`) that never matched `location.hash` (which starts with `#` not `/#`). Fixed in v1.0.217 along with broadened DOM selectors and diagnostic logging. However, the bug persisted — this was NOT the root cause.

**Root Cause (v1.0.218 — CONFIRMED):**
`google.com` is present in the Global Safe List (fetched from Supabase). When `scanAndHandle()` runs in the service worker, the FIRST thing it does is call `isWhitelisted(url)`. For `https://mail.google.com/...`, this extracts domain `mail.google.com`, then checks `'mail.google.com'.endsWith('.google.com')` → **TRUE** → **`return;`** — the function exits immediately without doing ANY scanning.

This applies to BOTH the initial `onBeforeNavigate` URL-only scan AND the email scanner's subsequent `SCAN_CURRENT_TAB` message with `forceRefresh: true` — because `handleScanCurrentTab` calls `scanAndHandle` with the same tab URL, hitting the same whitelist gate.

The result: the entire email scanning pipeline was dead. No URL was ever scanned, no email content was ever processed, no checks were ever run.

**Why was this hard to find:**
1. The whitelist check is a silent `return` — no log, no error, no warning.
2. The email scanner content script DID run correctly and DID extract content.
3. The `SCAN_CURRENT_TAB` message WAS sent to the background.
4. But the background's `scanAndHandle` silently exited before processing it.
5. The popup showed "NO SCAN" which looked like an injection/timing issue, not a whitelist issue.

**Fix:**
Added an `isEmailScan` check to `scanAndHandle()` in `service-worker.js`. When `scanOptions.pageContent?.isEmailView` is true, the URL-level whitelist check is skipped. The scan targets the EMAIL CONTENT (sender reputation, body heuristics, link analysis), not the mail client's domain. Sender-level whitelisting (line 84-86) is preserved and still functions correctly.

Also includes v1.0.217 fixes (regex anchoring, path-based routing, broadened DOM selectors, diagnostic logging) which were correct but insufficient.

**Files Changed:**
- `extension/src/background/service-worker.js` — bypass URL whitelist for email views
- `extension/src/content/email-scanner.js` — regex fix + DOM selector broadening (v1.0.217)

**Lessons Learned:**
1. When debugging "nothing happens," trace the FULL call chain from message receipt to scan execution. Silent early returns (especially whitelist checks) can completely mask the real problem.
2. Diagnostic logging that says "scan triggered" is useless if the scanner never reaches the scan code. Log at EVERY gate (whitelist check, settings check, etc).
3. The Global Safe List is a double-edged sword: it correctly prevents false positives on safe domains, but it must NOT apply when the scan target is email CONTENT hosted on that domain.

## BUG-145: Missing Email Extractors Trigger Premature Target Timeout
**Date:** 2026-03-30
**Status:** In Progress (v1.0.224 Planned)
**Severity:** Critical

**Description:** Spam emails with only images (or < 5 characters of text) combined with altered sender/subject headers caused the email to evaluate as "not loaded" indefinitely. The extension would retry for 15s and eventually abort with "NO SCAN".
**Root Cause (Updated):**
The initial assumption was that the extraction failed because text was < 20 chars. However, scammers are actively using `<area>` tags (image maps) and `<svg>` to build emails completely devoid of `<a>` tags and text. This forces all our extractors (links, text, subject, sender) to fail in Gmail SPA views. Because `isLoaded` relied on at least ONE of these extractors succeeding to prove the DOM was "loaded", the scanner assumed the page was still loading and looped into a timeout.
**Fix (Planned):**
1. Add `<area>` tags to `extractEmailLinks()` to defeat image-map evasion.
2. Decouple `isLoaded` from extraction success by confirming the presence of the Gmail message container (`document.querySelector('.a3s')`) rather than relying purely on parsed string lengths.
3. Enhance `extractSubject()` to correctly pull text from the `<title>` element (using `.textContent`) as a bulletproof structural fallback.
**Lessons Learned:**
Heuristics that block critical orchestration layers must use defensive, redundant proofs of life. Wait-loops that rely purely on string lengths will silently trap edge-case DOM structures. Extraction success does not equal page load completion.

### Update 2026-03-30 14:15: BUG-145 Re-opened & Fixed
The previous iteration (v1.0.224) failed for two intersecting reasons:
1. **Build Failure:** The extension directory was never rebuilt, meaning the DevPanel in the `v1.0.223` screenshot was still running the old logic.
2. **Race Condition Introduction:** While reviewing the v1.0.224 code, a race condition was identified. In an effort to stop the scanner from hanging on textless emails, `isLoaded` was tied to the presence of the `.a3s` container. However, Gmail SPAs inject the container *empty* prior to binding data. This caused `triggerScan` to fire immediately, resulting in completely empty payloads before any extractors had time to run.

**The Fix (v1.0.225):**
Reverted `isLoaded` to rely purely on data extraction success (restoring the retry loop). Since the extractors in `parser.js` were fundamentally upgraded to capture `<area>`, `title`, and `img[alt]`, image-only scams will now eventually satisfy the `data` requirement and trigger a scan correctly, preventing infinite loops without bypassing the lazy-load wait timer.

### Update 2026-03-30 14:38: BUG-145 Root Cause of Data Collision & Empty Wrapper Discovered
The v1.0.225 rollout did not resolve the "NO SCAN" / "Not extracted" error in the DevPanel. A thorough investigation into `scan_cache_` assignment and URL normalizations identified two compounding data-handling flaws in the pipeline:

1. **SPA Fragment Collisions (`storage.js`):** The caching engine's `normalizeUrl()` utility intentionally strips `#` fragments (e.g. hash-routing) to deduplicate URL scans. However, Gmail is an SPA where the *only* difference between emails is the fragment (`#inbox/ABC123`). This means **every Gmail email overwrites the exact same `scan_cache_https://mail.google.com/mail/u/0` key.**
2. **Payload Wrapper Unboxing (`popup.jsx`):** The popup reads the cache directly to render data instantly. However, `storage.js` wraps caches in a timestamp `{ result: {...}, timestamp: 1234 }`. Instead of unwrapping this, `popup.jsx` sets its state directly to the wrapper, causing `result.overallSeverity`, `result.metadata`, etc., to all evaluate as `undefined`. 
3. **Ghost Retry (`handler.js`):** The `FORCE_RESCAN` action relies entirely on `bodyReady` to stop polling the content script. For image-only phishing emails, `bodyReady` evaluate to false permanently.

**Upcoming Fixes (Plan approved via /rock_solid_plan_review):**
- Lock `normalizeUrl` fragment stripping behind an SPA domain check. If it's `mail.google.com` or `outlook.live.com`, preserve the fragment so emails get their own discrete cache slots.
- Unwrap `cached.result` safely in `popup.jsx` (with null checks).
- Accept non-body data (`sender`, `subject`) to break the 5-retry loop for image-only emails on manual user rescans.
# BUG-146 [Hydra Guard] Infinite Loading on Email Scans

## Context
The user reported that the 'Rescan Email Content' button triggers an endless loading state ('Analyzing Safety...') and fails to show any extracted email context even when it finally finishes on subsequent clicks.

## Root Cause
The `scanInProgress` boolean lock array in the `TabStateManager` instance was intentionally set to `true` upon first load or reload by `navigation-handler.js`. However, the main `scanAndHandle` routine in `service-worker.js` completely failed to revert this boolean to `false` upon completion (either successfully or during a throw). This indefinitely jammed the task queue for that particular tab ID. Consequently, when the manual override `FORCE_RESCAN` was triggered, it assumed there was another scan ongoing and preemptively skipped the DOM text extraction phase (to prevent collisions). The scanner ran anyway, but with an artificially blank email `pageContent`, triggering the Empty Payload Safeguard and printing the 'No email context extracted' warning.

## Resolution
Wrapped the entirety of the `scanAndHandle` routine (which contains dozens of async bail-outs and error catches) inside a `finally` block to universally trigger `scanInProgress: false` guarantees upon exit.
Additionally stripped the residual validation logic out of the `FORCE_RESCAN` handler which is meant to be a manual brute force un-jammer and should not be bounded by brittle background flags.

# BUG-147: "Analyzing Safety" UI hang on extraction failure

## Context
Persistent reports of the extension getting stuck in the "Analyzing Safety..." state, particularly on emails where extraction might be failing or taking too long. The "Rescan" button would occasionally fix it, but the root cause of the hang remained.

## Root Cause
The `scanAndHandle` function in `service-worker.js` was missing a guaranteed exit signal for the UI. While it had a `finally` block to clear `scanInProgress`, it did *not* have a guaranteed `chrome.runtime.sendMessage` broadcast in its `catch` or `finally` blocks. If an error occurred (e.g., in `fetchEmailContextWithRetry` or AI validation), the function would log the error but the popup would never receive the `SCAN_RESULT_UPDATED` message, leaving the React `scanInProgress` state set to `true` indefinitely.

## Resolution
1. **Result Hoisting**: Declared the `result` object at the top of `scanAndHandle` with a safe `UNKNOWN` fallback state.
2. **Explicit Catch Broadcasting**: Updated the `catch` block to populate this `result` with specific error metadata (e.g., `EXTRACTION_ERROR`) to give the user feedback.
3. **Deterministic Exit Signal**: Implemented a `broadcastSent` flag and a `finally` block that unconditionally sends the current `result` (even if it's the `UNKNOWN` fallback) if no broadcast has been sent yet. This ensures the "Analyzing Safety" spinner is always dismissed.

## Lessons Learned
In MV3 Service Workers, the messaging lifecycle must be treated as a strict contract. If the UI starts a "wait" state based on an operation, that operation MUST provide a terminal signal (success or failure) in all code paths. Using a `finally` block for the messaging signal (not just the state lock) is the most robust way to fulfill this contract.

