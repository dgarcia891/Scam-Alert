/**
 * @jest-environment jsdom
 *
 * Regression test suite for BUG-146: extraction-logic.js parser.js fallback integration.
 *
 * Tests cover:
 *  1. Happy path: Phase 1 succeeds → parser.js NOT called (spy verified, M-4)
 *  2. Body fallback: Phase 1 body empty → extractEmailText() fires
 *  3. Sender fallback: Phase 1 has body + subject but no valid sender
 *  4. Subject fallback: Phase 1 has body + sender but no subject (M-4 new)
 *  5. UI-noise guard: parser.js returns Gmail chrome text → rejected (M-1)
 *  6. Null client: early return, no parser calls (M-4 spy verified)
 */
import { jest } from '@jest/globals';

// ── Mock email-clients.js BEFORE importing extraction-logic ──────────────────
let mockClient = {
    id: 'gmail',
    label: 'Gmail',
    selectors: {
        messageBody: '.a3s.aiL',
        sender: '.gD',
        subject: 'h2.hP'
    },
    senderExtractor: 'attribute',
    iframeExtraction: false,
    iframeSelector: null
};

jest.unstable_mockModule('../../extension/src/config/email-clients.js', () => ({
    getMatchingClient: jest.fn(() => mockClient)
}));

// ── Mock parser.js to gain spy access ────────────────────────────────────────
let parserBodyResult = '';
let parserSenderResult = { name: '', email: '' };
let parserSubjectResult = 'Unknown Subject';

jest.unstable_mockModule('../../extension/src/lib/scanner/parser.js', () => ({
    extractEmailText:   jest.fn(() => parserBodyResult),
    parseSenderInfo:    jest.fn(() => parserSenderResult),
    extractSubject:     jest.fn(() => parserSubjectResult),
    // extractEmailLinks and extractHiddenHeaders are not used inside extractEmailData
    extractEmailLinks:  jest.fn(() => ({ links: [], rawUrls: [] })),
    extractHiddenHeaders: jest.fn(() => ({}))
}));

// ── Dynamic imports after mocking ────────────────────────────────────────────
const { extractEmailData } = await import('../../extension/src/content/email/extraction-logic.js');
const parserMod = await import('../../extension/src/lib/scanner/parser.js');

// ─────────────────────────────────────────────────────────────────────────────

describe('BUG-146: extraction-logic fallback integration', () => {

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';
        document.title = 'Gmail - Inbox';

        // Polyfill innerText for jsdom
        if (!HTMLElement.prototype.hasOwnProperty('innerText')) {
            Object.defineProperty(HTMLElement.prototype, 'innerText', {
                get() {
                    // Very simple polyfill for tests: respect inline display:none
                    if (this.style && this.style.display === 'none') {
                        return '';
                    }
                    if (this.id && this.id.startsWith('msg') && this.id !== 'msg3') {
                        // Hack specifically for the thread simulation test T-7
                        // We could also just set inline styles in the test itself.
                        return '';
                    }
                    return this.textContent;
                },
                configurable: true
            });
        }

        // Reset mock client to valid Gmail
        mockClient = {
            id: 'gmail',
            label: 'Gmail',
            selectors: {
                messageBody: '.a3s.aiL',
                sender:      '.gD',
                subject:     'h2.hP'
            },
            senderExtractor: 'attribute',
            iframeExtraction: false,
            iframeSelector: null
        };

        // Reset parser mock return values
        parserBodyResult    = '';
        parserSenderResult  = { name: '', email: '' };
        parserSubjectResult = 'Unknown Subject';

        // Clear spy call counts
        jest.clearAllMocks();

        console.log  = jest.fn();
        console.warn = jest.fn();
    });

    // ── Test 1: Happy path — Phase 1 succeeds, parser.js must NOT be called ──
    test('Phase 1 success: parser.js fallbacks are NOT called (spy-verified)', () => {
        document.body.innerHTML = `
            <div class="a3s aiL">This is a valid email body that is longer than 20 characters.</div>
            <div class="gD" name="Valid Sender" email="valid@example.com">Valid Sender</div>
            <h2 class="hP">Valid Subject</h2>
        `;

        const result = extractEmailData();

        // Correct output
        expect(result.bodyText).toBe('This is a valid email body that is longer than 20 characters.');
        expect(result.senderEmail).toBe('valid@example.com');
        expect(result.subject).toBe('Valid Subject');
        expect(result.isEmailView).toBe(true);

        // M-4: Parser must NOT have been touched
        expect(parserMod.extractEmailText).not.toHaveBeenCalled();
        expect(parserMod.parseSenderInfo).not.toHaveBeenCalled();
        expect(parserMod.extractSubject).not.toHaveBeenCalled();
    });

    // ── Test 2: Body fallback fires when Phase 1 finds nothing ───────────────
    test('Phase 1 body empty: extractEmailText() fallback fires', () => {
        parserBodyResult   = 'Fallback body from parser.js — longer than 20 chars.';
        parserSenderResult = { name: 'Fallback Sender', email: 'fallback@example.com' };
        parserSubjectResult = 'Fallback Subject';

        // No email body in the DOM
        document.body.innerHTML = `
            <div class="a3s aiL"></div>
            <span email="fallback@example.com" name="Fallback Sender">fallback@example.com</span>
            <h2 class="hP">Fallback Subject</h2>
        `;

        const result = extractEmailData();

        expect(parserMod.extractEmailText).toHaveBeenCalled();
        expect(result.bodyText).toBe('Fallback body from parser.js — longer than 20 chars.');
        expect(result.isEmailView).toBe(true);
    });

    // ── Test 3: Sender fallback fires when Phase 1 finds no valid sender ─────
    test('Phase 1 sender missing: parseSenderInfo() fallback fires', () => {
        parserSenderResult = { name: 'Parser Sender', email: 'parser@example.com' };
        parserSubjectResult = 'Real Subject'; // will get short-circuited by h2.hP

        document.body.innerHTML = `
            <div class="a3s aiL">This is a valid body long enough to satisfy Phase 1 gate of 5 chars.</div>
            <h2 class="hP">Real Subject</h2>
        `;
        // No .gD sender element — Phase 1 sender extraction yields empty

        const result = extractEmailData();

        expect(parserMod.extractEmailText).not.toHaveBeenCalled(); // body was fine
        expect(parserMod.parseSenderInfo).toHaveBeenCalled();
        expect(result.senderEmail).toBe('parser@example.com');
        expect(result.bodyText).toBe('This is a valid body long enough to satisfy Phase 1 gate of 5 chars.');
    });

    // ── Test 4 (M-4 NEW): Subject fallback fires when Phase 1 finds no subject
    test('Phase 1 subject missing: extractSubject() fallback fires', () => {
        parserSubjectResult = 'Parser Extracted Subject';

        document.body.innerHTML = `
            <div class="a3s aiL">Body text that is long enough to pass Phase 1.</div>
            <div class="gD" name="Sender Name" email="sender@example.com">Sender Name</div>
        `;
        // No h2.hP — Phase 1 subject extraction yields empty

        const result = extractEmailData();

        expect(parserMod.extractEmailText).not.toHaveBeenCalled(); // body was fine
        expect(parserMod.parseSenderInfo).not.toHaveBeenCalled();  // sender was fine
        expect(parserMod.extractSubject).toHaveBeenCalled();
        expect(result.subject).toBe('Parser Extracted Subject');
    });

    // ── Test 5 (M-1 NEW): UI-noise guard rejects Gmail chrome text ───────────
    test('UI-noise guard: rejects parser.js body starting with Gmail nav labels', () => {
        // What parser.js Tier 3 returns on an image-only email in Gmail
        parserBodyResult = 'Compose\nPrimary\nSocial\nPromotions\nUpdates\nForums';

        document.body.innerHTML = `
            <div class="a3s aiL"></div>
        `;
        // No sender selector, no subject selector

        const result = extractEmailData();

        expect(parserMod.extractEmailText).toHaveBeenCalled();
        // The UI chrome text MUST be rejected — bodyText stays empty
        expect(result.bodyText).toBe('');
        // Warn should have been called
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('UI chrome detected')
        );
    });

    // ── Test 6: Null client → early return, no parser calls ──────────────────
    test('Null client: early return without calling any parser fallbacks', () => {
        mockClient = null; // Simulate unrecognized URL (e.g., example.com/settings)

        const result = extractEmailData();

        expect(result.isEmailView).toBe(false);
        expect(result.bodyText).toBe('');
        expect(parserMod.extractEmailText).not.toHaveBeenCalled();
        expect(parserMod.parseSenderInfo).not.toHaveBeenCalled();
        expect(parserMod.extractSubject).not.toHaveBeenCalled();
    });

    // ── Test 7 (NEW): Thread simulation — 3 body elements, only last has text
    test('Thread simulation (Body): extractEmailData selects the last visible message in a thread', () => {
        document.body.innerHTML = `
            <div id="msg1" class="a3s aiL" style="display: none;">Collapsed text 1</div>
            <div id="msg2" class="a3s aiL" style="display: none;">Collapsed text 2</div>
            <div id="msg3" class="a3s aiL">This is the visible expanded message body text that we want.</div>
        `;

        const result = extractEmailData();

        expect(result.bodyText).toBe('This is the visible expanded message body text that we want.');
        expect(parserMod.extractEmailText).not.toHaveBeenCalled();
    });

    // ── Test 8 (NEW): Thread simulation — 3 sender elements, only last is valid
    test('Thread simulation (Sender): extractEmailData selects the last sender element in a thread', () => {
        document.body.innerHTML = `
            <div class="a3s aiL">A body to satisfy phase 1</div>
            <div class="gD" name="Sender 1" email="sender1@example.com">Sender 1</div>
            <div class="gD" name="Sender 2" email="sender2@example.com">Sender 2</div>
            <div class="gD" name="Sender 3" email="open_message@example.com">Sender 3</div>
        `;

        const result = extractEmailData();

        expect(result.senderEmail).toBe('open_message@example.com');
        expect(parserMod.parseSenderInfo).not.toHaveBeenCalled();
    });
});
