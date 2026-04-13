# Workflow: plan

## 1. Clarify Request
- The user is asking "why is google still not being scanned?" and provided a screenshot of an email in Gmail.
- The screenshot shows an email with no body text (just an attachment), and Hydra Guard failing with "Sender: Not extracted", "Subject: Not captured", and "No content was extracted."
- **Classification:** Non-trivial. It touches core heuristic extraction logic and state orchestration in `email-scanner.js`. This plan is intended for the full dev loop.

## 2. Load Context
- **Architecture:** Hydra Guard uses a content script (`email-scanner.js`) injected into webmail clients to extract signals (sender, subject, body).
- **Recent Bugs:** BUG-127 and BUG-131 introduced a 5-retry loop for lazy-loading Gmail content.
- **Constraints:** We must preserve the retry loop for *actually* lazy-loading emails, while preventing it from permanently failing on *genuinely* short/empty emails.

## 3. Identify Surfaces
- **Code:** `extension/src/content/email-scanner.js` (orchestrator).
- **Code:** `extension/src/lib/scanner/parser.js` (extraction logic).

## 4. Codebase Scan Findings
- In `email-scanner.js` (`triggerScan()`):
  ```javascript
  const data = extractEmailText();
  if (!data) {
      // Retries 5 times, then sends { extractionFailed: true }
      // This SKIPS parseSenderInfo() and extractSubject() entirely!
      return;
  }
  const senderInfo = parseSenderInfo();
  // ...
  ```
- Because of `text.length > 20` minimums in `parser.js`, an email with just an attachment (or <20 chars of text) returns `data = ''`. 
- This triggers the retry loop which eventually times out and drops the scan, **never extracting the sender or subject** even though they exist in the DOM.

## 5. Multi-Angle Options

### Option A: Lower the 20-character minimum in `parser.js`
- **Pros:** Simple fix.
- **Cons:** Fails to handle truly empty emails (e.g. image-only spam). If the body is 0 chars, it still triggers the retry loop and drops the sender.

### Option B: Change the retry condition in `email-scanner.js` to rely on sender/subject presence
- **Pros:** Robust. If the sender or subject is present in the DOM, we know the email has loaded. If the body is empty, it's genuinely empty. We extract everything available, check `isLoaded = sender.email || subject || data.length > 20`, and only retry if `!isLoaded`.
- **Cons:** Slightly refactors `triggerScan`.

### Option C: Always extract everything, even on retry failure payload
- **Pros:** If retries fail, we still send what we have (`extractionFailed: true` but maybe we include `sender` and `subject`).
- **Cons:** If it *is* an empty email, we shouldn't wait 8 seconds (the retry delay) before scanning. Option B avoids the 8-second delay entirely for empty emails because it knows the DOM is loaded via the sender.

**Selected Approach: Option B + Option C Hybrid.**
We will extract all metadata at the top of `triggerScan`. If the sender OR the subject OR the body is found, the email DOM has rendered. We proceed immediately. `extractionFailed` is only triggered if ALL of them are empty after 5 retries.

## 6. Implementation Plan

### `extension/src/content/email-scanner.js`
Modify `triggerScan()` to extract all context first:
```javascript
const bodyText = extractEmailText();
const senderInfo = parseSenderInfo();
const subject = extractSubject();
const headers = extractHiddenHeaders();
const linkData = extractEmailLinks();

// Consider the email "loaded" if we have meaningful content OR a sender email OR a subject
const isLoaded = !!(bodyText || senderInfo.email || subject);

if (!isLoaded) {
    if (extractionRetryCount < MAX_EXTRACTION_RETRIES) {
        // ... exponential backoff ...
    } else {
        // ... failure payload ...
    }
    return;
}

// Proceed with scan payload
```

## 7. Database Safety
- **Database Safety Review:** NOT APPLICABLE (Content script parsing logic).
- **Pagination reviewed:** NOT APPLICABLE.
- **Index review:** NOT APPLICABLE.
- **RLS reviewed:** NOT APPLICABLE.
