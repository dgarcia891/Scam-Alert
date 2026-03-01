/**
 * Email Scanner Orchestrator Tests
 * Replaces the placeholder test with real coverage of:
 *   - extractEmailText (parser.js)
 *   - parseSenderInfo (parser.js)
 *   - runHeuristics (heuristics.js)
 *   - isRiskyLink / setupLinkInterceptor (link-interceptor.js)
 *   - getEmailSettings / shouldShowPrompt (extraction-logic.js)
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// ── 1. Parser Tests ─────────────────────────────────────────────────────────

describe('extractEmailText (parser.js)', () => {
    // Import the parser module; uses jsdom from jest config
    let extractEmailText, parseSenderInfo;

    beforeEach(async () => {
        // Clean DOM between tests
        document.body.innerHTML = '';
        const parser = await import('../../extension/src/lib/scanner/parser.js');
        extractEmailText = parser.extractEmailText;
        parseSenderInfo = parser.parseSenderInfo;
    });

    test('extracts text from Gmail body (.a3s.aiL selector)', () => {
        document.body.innerHTML = `
            <div class="a3s aiL">
                Hello, please buy some gift cards for the team event.
            </div>
        `;
        const text = extractEmailText();
        expect(text).toContain('gift cards');
        expect(text.length).toBeGreaterThan(0);
    });

    test('extracts text from Outlook body selector', () => {
        document.body.innerHTML = `
            <div data-test-id="message-view-body">
                Your invoice is overdue. Please send wire transfer.
            </div>
        `;
        const text = extractEmailText();
        expect(text).toContain('invoice');
    });

    test('extracts text from generic fallback selector', () => {
        document.body.innerHTML = `
            <div class="Email-Message-Body">
                Check out this amazing offer!
            </div>
        `;
        const text = extractEmailText();
        expect(text).toContain('amazing offer');
    });

    test('returns empty string when no email body found', () => {
        document.body.innerHTML = '<div>Not an email</div>';
        const text = extractEmailText();
        expect(text).toBe('');
    });

    test('parseSenderInfo extracts Gmail sender name and email', () => {
        document.body.innerHTML = `
            <span class="gD" name="John Doe">John Doe</span>
            <span class="go" email="john@gmail.com">john@gmail.com</span>
        `;
        // jsdom doesn't implement innerText — polyfill it for the source code
        const gD = document.querySelector('.gD');
        Object.defineProperty(gD, 'innerText', { value: gD.textContent, configurable: true });

        const info = parseSenderInfo();
        expect(info.name).toBe('John Doe');
        expect(info.email).toBe('john@gmail.com');
    });

    test('parseSenderInfo returns defaults when no elements found', () => {
        document.body.innerHTML = '<div>empty</div>';
        const info = parseSenderInfo();
        expect(info.name).toBe('Unknown');
        expect(info.email).toBe('');
    });
});

// ── 2. Heuristics Tests ─────────────────────────────────────────────────────

describe('runHeuristics (heuristics.js)', () => {
    let runHeuristics;

    beforeEach(async () => {
        const mod = await import('../../extension/src/lib/scanner/heuristics.js');
        runHeuristics = mod.runHeuristics;
    });

    test('returns not-scam for empty text', () => {
        const result = runHeuristics('');
        expect(result.isScam).toBe(false);
        expect(result.signals).toHaveLength(0);
    });

    test('returns not-scam for null text', () => {
        const result = runHeuristics(null);
        expect(result.isScam).toBe(false);
    });

    test('detects gift card request pattern', () => {
        const result = runHeuristics('Please buy a Google Play gift card and send me the code.');
        expect(result.isScam).toBe(true);
        expect(result.signals).toEqual(
            expect.arrayContaining([expect.objectContaining({ label: 'Gift Card Request' })])
        );
        expect(result.maxScore).toBeGreaterThanOrEqual(50);
    });

    test('detects financial urgency (wire transfer)', () => {
        const result = runHeuristics('We need a wire transfer immediately. The invoice is overdue.');
        expect(result.isScam).toBe(true);
        expect(result.signals).toEqual(
            expect.arrayContaining([expect.objectContaining({ label: 'Financial Urgency' })])
        );
    });

    test('detects code extraction pattern', () => {
        const result = runHeuristics('Scratch the back and send me a photo of the code.');
        expect(result.isScam).toBe(true);
        expect(result.signals).toEqual(
            expect.arrayContaining([expect.objectContaining({ label: 'Code Extraction' })])
        );
        expect(result.maxScore).toBeGreaterThanOrEqual(60);
    });

    test('multiple patterns stack signals', () => {
        const result = runHeuristics('Buy a gift card. Scratch the back of the code. This is overdue, send via wire transfer.');
        expect(result.isScam).toBe(true);
        expect(result.signals.length).toBeGreaterThanOrEqual(2);
    });

    test('clean text returns no signals', () => {
        const result = runHeuristics('Hi team, the quarterly report is ready for review. See you at the meeting.');
        expect(result.isScam).toBe(false);
        expect(result.signals).toHaveLength(0);
        expect(result.maxScore).toBe(0);
    });
});

// ── 3. Link Interceptor Tests ───────────────────────────────────────────────

describe('isRiskyLink (link-interceptor.js)', () => {
    let isRiskyLink;

    beforeEach(async () => {
        const mod = await import('../../extension/src/content/email/link-interceptor.js');
        isRiskyLink = mod.isRiskyLink;
    });

    test('returns false for null/empty URL', () => {
        expect(isRiskyLink(null)).toBe(false);
        expect(isRiskyLink('')).toBe(false);
    });

    test('flags .exe download links', () => {
        expect(isRiskyLink('https://download.example.com/setup.exe')).toBe(true);
    });

    test('flags .zip download links', () => {
        expect(isRiskyLink('https://files.example.com/archive.zip')).toBe(true);
    });

    test('flags .pdf download links', () => {
        expect(isRiskyLink('https://files.example.com/invoice.pdf')).toBe(true);
    });

    test('flags .dmg, .scr, .vbs, .bat, .ps1 extensions', () => {
        expect(isRiskyLink('https://x.com/app.dmg')).toBe(true);
        expect(isRiskyLink('https://x.com/file.scr')).toBe(true);
        expect(isRiskyLink('https://x.com/script.vbs')).toBe(true);
        expect(isRiskyLink('https://x.com/run.bat')).toBe(true);
        expect(isRiskyLink('https://x.com/deploy.ps1')).toBe(true);
    });

    test('flags Google Docs/Drive links', () => {
        expect(isRiskyLink('https://docs.google.com/document/d/abc123')).toBe(true);
        expect(isRiskyLink('https://drive.google.com/file/d/xyz')).toBe(true);
    });

    test('flags Dropbox links', () => {
        expect(isRiskyLink('https://www.dropbox.com/s/abc/file.pdf')).toBe(true);
    });

    test('flags OneDrive links', () => {
        expect(isRiskyLink('https://onedrive.live.com/view?id=abc')).toBe(true);
    });

    test('flags SharePoint links', () => {
        expect(isRiskyLink('https://company.sharepoint.com/docs/file.docx')).toBe(true);
    });

    test('flags export=download query param', () => {
        expect(isRiskyLink('https://example.com/file?export=download')).toBe(true);
    });

    test('flags alt=media query param', () => {
        expect(isRiskyLink('https://example.com/file?alt=media')).toBe(true);
    });

    test('does NOT flag normal webpage URLs', () => {
        expect(isRiskyLink('https://www.google.com/search?q=test')).toBe(false);
        expect(isRiskyLink('https://amazon.com/product/123')).toBe(false);
        expect(isRiskyLink('https://news.ycombinator.com')).toBe(false);
    });

    test('returns false for invalid/relative URLs gracefully', () => {
        expect(isRiskyLink('not-a-url')).toBe(false);
        expect(isRiskyLink('/relative/path')).toBe(false);
    });
});

describe('setupLinkInterceptor (link-interceptor.js)', () => {
    let setupLinkInterceptor;

    beforeEach(async () => {
        document.body.innerHTML = '';
        const mod = await import('../../extension/src/content/email/link-interceptor.js');
        setupLinkInterceptor = mod.setupLinkInterceptor;
    });

    test('calls callback when risky link is clicked', () => {
        const callback = jest.fn();
        setupLinkInterceptor(callback);

        document.body.innerHTML = '<a href="https://drive.google.com/file/d/malicious">Click me</a>';
        const anchor = document.querySelector('a');
        anchor.click();

        expect(callback).toHaveBeenCalledWith('https://drive.google.com/file/d/malicious');
    });

    test('does NOT call callback for safe links', () => {
        const callback = jest.fn();
        setupLinkInterceptor(callback);

        document.body.innerHTML = '<a href="https://google.com/search">Safe link</a>';
        const anchor = document.querySelector('a');
        anchor.click();

        expect(callback).not.toHaveBeenCalled();
    });
});

// ── 4. Extraction Logic Tests ───────────────────────────────────────────────

describe('getEmailSettings (extraction-logic.js)', () => {
    let getEmailSettings, shouldShowPrompt;

    beforeEach(async () => {
        const mod = await import('../../extension/src/content/email/extraction-logic.js');
        getEmailSettings = mod.getEmailSettings;
        shouldShowPrompt = mod.shouldShowPrompt;

        // Reset chrome.storage mock
        chrome.storage.local.get.mockReset();
    });

    test('returns enabled=true by default when no settings stored', async () => {
        chrome.storage.local.get.mockImplementation((keys, cb) => {
            cb({ settings: {} });
        });

        const settings = await getEmailSettings();
        expect(settings.enabled).toBe(true);
        expect(settings.promptDisabled).toBe(false);
    });

    test('returns enabled=false when emailScanningEnabled is false', async () => {
        chrome.storage.local.get.mockImplementation((keys, cb) => {
            cb({ settings: { emailScanningEnabled: false } });
        });

        const settings = await getEmailSettings();
        expect(settings.enabled).toBe(false);
    });

    test('shouldShowPrompt returns false when enabled', async () => {
        const result = await shouldShowPrompt({ enabled: true, promptDisabled: false });
        expect(result).toBe(false);
    });

    test('shouldShowPrompt returns false when prompt is permanently dismissed', async () => {
        const result = await shouldShowPrompt({ enabled: false, promptDisabled: true });
        expect(result).toBe(false);
    });

    test('shouldShowPrompt returns true when disabled and not dismissed', async () => {
        chrome.storage.local.get.mockImplementation((keys, cb) => {
            cb({ emailPromptSessionDismissed: false });
        });

        const result = await shouldShowPrompt({ enabled: false, promptDisabled: false });
        expect(result).toBe(true);
    });

    test('shouldShowPrompt returns false when session-dismissed', async () => {
        chrome.storage.local.get.mockImplementation((keys, cb) => {
            cb({ emailPromptSessionDismissed: true });
        });

        const result = await shouldShowPrompt({ enabled: false, promptDisabled: false });
        expect(result).toBe(false);
    });
});

// ── 5. Extraction Data Tests ────────────────────────────────────────────────

describe('extractEmailData (extraction-logic.js)', () => {
    let extractEmailData;

    beforeEach(async () => {
        document.body.innerHTML = '';
        const mod = await import('../../extension/src/content/email/extraction-logic.js');
        extractEmailData = mod.extractEmailData;
    });

    test('extracts Gmail email data from DOM', () => {
        // Simulate Gmail DOM
        delete window.location;
        window.location = new URL('https://mail.google.com/mail/u/0/#inbox/abc123');

        document.body.innerHTML = `
            <div class="a3s aiL">This is the email body with suspicious content.</div>
            <span class="gD" name="Jane Doe" email="jane@example.com">Jane Doe</span>
            <div class="hP">Subject: Important Meeting</div>
        `;

        // jsdom doesn't implement innerText — polyfill it on the elements the source reads
        for (const el of document.querySelectorAll('.a3s.aiL, .gD, .hP')) {
            Object.defineProperty(el, 'innerText', { value: el.textContent, configurable: true });
        }

        const data = extractEmailData();
        expect(data.isEmailView).toBe(true);
        expect(data.bodyText).toContain('suspicious content');
        expect(data.senderName).toBe('Jane Doe');
        expect(data.subject).toContain('Important Meeting');
    });

    test('returns empty data when no email elements found', () => {
        delete window.location;
        window.location = new URL('https://www.google.com');

        document.body.innerHTML = '<div>Not an email page</div>';

        const data = extractEmailData();
        expect(data.isEmailView).toBe(true); // Always true from this function
        expect(data.bodyText).toBe('');
    });
});
