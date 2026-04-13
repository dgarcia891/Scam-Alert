/**
 * Regression guard for BUG-NEW: Gmail Inbox False Positive
 *
 * Verifies that isEmailReadingViewForClient() correctly distinguishes between:
 *   A) An inbox list view with a [data-legacy-thread-id] row  → MUST return false
 *   B) An actual open email with h2.hP in the DOM            → MUST return true
 *   C) An inbox page with no reading-view signals at all     → MUST return false
 *
 * Exits with code 1 if any assertion fails, so this can be wired into CI.
 */

import { EMAIL_CLIENTS } from './src/config/email-clients.js';
import { isEmailReadingViewForClient } from './src/content/email/extraction-logic.js';
import { JSDOM } from 'jsdom';

let failures = 0;

function assert(label, expected, actual) {
    if (actual === expected) {
        console.log(`  ✅ PASS: ${label}`);
    } else {
        console.error(`  ❌ FAIL: ${label} — expected ${expected}, got ${actual}`);
        failures++;
    }
}

const gmailClient = EMAIL_CLIENTS.find(c => c.id === 'gmail');

// ─── TEST A: Inbox list row with data-legacy-thread-id ────────────────────────
// This is the exact pattern that caused the bug: Gmail attaches [data-legacy-thread-id]
// to <tr> rows in the inbox list. Must NOT be treated as an email reading view.
console.log('\nTEST A: Inbox list row with [data-legacy-thread-id] → expect false');
{
    const dom = new JSDOM(`<!DOCTYPE html><html><body>
        <div role="main">
            <table>
                <tr data-legacy-thread-id="abc123"><td>Some email row</td></tr>
                <tr data-legacy-thread-id="def456"><td>Another row</td></tr>
            </table>
        </div>
    </body></html>`);
    global.document = dom.window.document;
    global.location = { hash: '#inbox', href: 'https://mail.google.com/mail/u/0/#inbox' };
    assert('Inbox list row should not trigger reading view', false, isEmailReadingViewForClient(gmailClient));
}

// ─── TEST B: Open email with h2.hP (subject line) ────────────────────────────
// This is the legitimate case: h2.hP appears only when an email is open.
// The guard must NOT block this — legit emails must still scan.
console.log('\nTEST B: Open email with h2.hP → expect true');
{
    const dom = new JSDOM(`<!DOCTYPE html><html><body>
        <div role="main">
            <h2 class="hP">Your password reset request</h2>
            <div class="a3s aiL">Click here to reset your password...</div>
        </div>
    </body></html>`);
    global.document = dom.window.document;
    global.location = { hash: '#inbox/abc123', href: 'https://mail.google.com/mail/u/0/#inbox/abc123' };
    assert('Open email with h2.hP should trigger reading view', true, isEmailReadingViewForClient(gmailClient));
}

// ─── TEST C: Inbox URL, no reading-view DOM signals ───────────────────────────
// Plain inbox with no selectors, no hash suffix — must not scan.
console.log('\nTEST C: Inbox page with no reading-view signals → expect false');
{
    const dom = new JSDOM(`<!DOCTYPE html><html><body>
        <div role="main">
            <div>Welcome to Gmail</div>
        </div>
    </body></html>`);
    global.document = dom.window.document;
    global.location = { hash: '#inbox', href: 'https://mail.google.com/mail/u/0/#inbox' };
    assert('Empty inbox page should not trigger reading view', false, isEmailReadingViewForClient(gmailClient));
}

// ─── RESULTS ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failures === 0) {
    console.log('✅ ALL TESTS PASSED — Gmail false-positive regression guard clean.');
    process.exit(0);
} else {
    console.error(`❌ ${failures} TEST(S) FAILED — regression detected!`);
    process.exit(1);
}
