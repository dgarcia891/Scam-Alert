# Workflow: Fix Highlighter for Email Scams

## Plan Details

1. **Fix Email Keyword Mapping (`email-heuristics.js`)**
   - We will add the words `"login", "verify", "account", "identity", "password", "code"` to the `securityKeywords` array.
   - When constructing `visualIndicators`, if the `Account security or payment lure` indicator triggers, we pass its unified category logic to EVERY single word that triggered it. This resolves the user's frustration of seeing generic out-of-context examples, while keeping the UI highlighted.

2. **Fix `explanations.js`**
   - Add the specific indicator explanation for `Account security or payment lure`:
     - **Category:** Account Security Lure
     - **Reason:** The presence of multiple security-related words close together (e.g., login, verify, account, code) indicates the sender is trying to create pressure to compromise your account.

3. **Revert Pattern-Analyzer Content Scanner (`pattern-analyzer.js`)**
   - We remove the strict phrase matcher from emails because Gmail breaks phrases across text nodes natively, causing our DOM TreeWalker to fail. Finding contextual keywords via `email-heuristics.js` accomplishes the same task effectively while navigating around TreeWalker limits.

