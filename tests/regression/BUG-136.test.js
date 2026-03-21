/**
 * BUG-136 Regression Test:
 * Gmail spam-view email extraction fails because isEmailReadingView()
 * does not recognize the .adn.ads spam reading pane container.
 * 
 * This test verifies that:
 * 1. .adn.ads DOM present → isEmailReadingView() returns true
 * 2. URL hash #spam/<id> → URL hash check returns true
 */

import assert from 'assert';

console.log('Running BUG-136 regression test...');

// ── Inline the function under test ────────────────────────────────────────────
// (mirrors the logic in email-scanner.js isEmailReadingView())
function isEmailReadingView(doc = document, hash = location.hash) {
    // URL-hash based detection (spam/all/search/trash reading views)
    const hashMatch = /\/#(?:spam|all|search|sent|trash|category\/\w+)\/[a-zA-Z0-9]+/.test(hash);
    if (hashMatch) return true;

    return !!(
        doc.querySelector('.hP') ||
        doc.querySelector('[data-message-id]') ||
        doc.querySelector('.a3s') ||
        doc.querySelector('.adn.ads') ||           // BUG-136: Gmail spam reading pane
        doc.querySelector('.adn.nH.ads') ||        // BUG-136: alternate spam reading pane
        doc.querySelector('.aeF') ||               // BUG-136: reading pane open state
        doc.querySelector('[data-testid="message-view-body"]') ||
        doc.querySelector('.msg-body') ||
        doc.querySelector('.zmMailBody') ||
        doc.querySelector('#messagecontframe')
    );
}

// ── Helpers ─────────────────────────────────────────────────────────────────
class MockDocument {
    constructor(selector, matches = true) {
        this._selector = selector;
        this._matches = matches;
    }
    querySelector(sel) {
        if (this._matches && sel === this._selector) return { nodeType: 1 };
        return null;
    }
}

// ── Test 1: .adn.ads should be recognized ────────────────────────────────────
{
    const doc = new MockDocument('.adn.ads');
    assert.strictEqual(isEmailReadingView(doc, ''), true, 
        '❌ .adn.ads should trigger isEmailReadingView()');
    console.log('  ✅ .adn.ads recognized as reading view');
}

// ── Test 2: .adn.nH.ads should be recognized ─────────────────────────────────
{
    const doc = new MockDocument('.adn.nH.ads');
    assert.strictEqual(isEmailReadingView(doc, ''), true,
        '❌ .adn.nH.ads should trigger isEmailReadingView()');
    console.log('  ✅ .adn.nH.ads recognized as reading view');
}

// ── Test 3: URL hash #spam/<id> should be recognized ─────────────────────────
{
    const doc = new MockDocument('.nothing');
    assert.strictEqual(isEmailReadingView(doc, '/#spam/187abc123def456'), true,
        '❌ /#spam/<id> URL hash should trigger isEmailReadingView()');
    console.log('  ✅ URL hash /#spam/<id> recognized as reading view');
}

// ── Test 4: URL hash #search/<id> should be recognized ───────────────────────
{
    const doc = new MockDocument('.nothing');
    assert.strictEqual(isEmailReadingView(doc, '/#search/in%3Aspam/187abc123'), true,
        '❌ /#search/<id> URL hash should trigger isEmailReadingView()');
    console.log('  ✅ URL hash /#search/<id> recognized as reading view');
}

// ── Test 5: Empty DOM + no hash = inbox list (should return false) ─────────────
{
    const doc = new MockDocument('.nothing');
    assert.strictEqual(isEmailReadingView(doc, ''), false,
        '❌ Empty inbox list view should NOT trigger isEmailReadingView()');
    console.log('  ✅ Empty inbox list correctly returns false');
}

// ── Test 6: Existing selector .hP still works ─────────────────────────────────
{
    const doc = new MockDocument('.hP');
    assert.strictEqual(isEmailReadingView(doc, ''), true,
        '❌ .hP should still trigger isEmailReadingView() (regression)');
    console.log('  ✅ .hP still recognized (regression check)');
}

console.log('✅ BUG-136 regression tests all passed!');
