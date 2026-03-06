import { jest, describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXT = (rel) => path.resolve(__dirname, '../../extension/src', rel);

describe('BUG-082: SPA Back Navigation Fallback', () => {
    let messageListeners = [];
    let submitListeners = [];

    function loadContentScript() {
        // Reset DOM
        document.body.innerHTML = '';

        messageListeners = [];
        submitListeners = [];

        const scriptSource = fs.readFileSync(EXT('content/content.js'), 'utf-8')
            .replace(/^import\s+.*from\s+['"].*['"];?\s*/gm, '') // Strip imports
            .replace(/^export\s+\{[^}]*\}\s*;?\s*/gm, '') // Strip re-exports like export { OVERLAY_ID };
            .replace(/^export\s+/gm, ''); // Strip exports

        const wrappedSource = `(function() {
            const MessageTypes = {
                CONTEXT_DETECTED: 'context_detected',
                NAVIGATE_BACK: 'navigate_back',
                SCAN_RESULT: 'scan_result',
                SCAN_RESULT_UPDATED: 'scan_result_updated',
                SHOW_WARNING: 'show_warning',
                HIDE_WARNING: 'hide_warning',
                SHOW_BANNER: 'show_banner',
                OPEN_REPORT_MODAL: 'open_report_modal',
                EXECUTE_SCAN: 'execute_scan',
                SCAN_PROGRESS: 'scan_progress',
                REPORT_SCAM: 'report_scam',
                ANALYZE_PAGE: 'analyze_page'
            };
            const OVERLAY_ID = 'hydra-guard-overlay-root';
            
            // Mocks for dependencies that were stripped
            const detectContext = () => ({ type: 'web' });
            const detectEmailMetadata = () => null;
            const scanUrl = () => Promise.resolve({ overallSeverity: 'SAFE' });
            const highlightDetections = () => {};
            const removeHighlights = () => {};

            ${scriptSource}
            
            // Export to global for test access
            window.createOverlay = createOverlay;
        })();`;

        const fn = new Function('chrome', 'document', 'window', wrappedSource);
        fn(chrome, document, window);
    }

    beforeEach(() => {
        jest.useFakeTimers();
        const mockSendMessage = jest.fn().mockResolvedValue({ success: true });

        global.chrome = {
            runtime: {
                onMessage: { addListener: jest.fn((fn) => messageListeners.push(fn)) },
                sendMessage: mockSendMessage,
                getURL: (path) => path,
                onConnect: { addListener: jest.fn() }
            },
            storage: {
                local: {
                    get: jest.fn().mockResolvedValue({ settings: { highlightingEnabled: true } }),
                    set: jest.fn().mockResolvedValue(undefined)
                }
            }
        };

        // Mock window.location and history
        delete window.location;
        window.location = { href: 'https://mail.google.com/mail/u/0/#inbox' };
        delete window.history;
        window.history = {
            length: 5,
            back: jest.fn(() => {
                window.location.href = 'https://mail.google.com/mail/u/0/safe-page';
            })
        };

        loadContentScript();
    });

    afterEach(() => {
        jest.useRealTimers();
        delete window.createOverlay;
    });

    test('Overlay is removed and fallback is cancelled if NAVIGATE_BACK succeeds', async () => {
        window.createOverlay({
            recommendations: ['Danger'],
            checks: { phishing: { flagged: true, title: 'Phishing', details: 'Phishing domain' } }
        });

        const root = document.getElementById('hydra-guard-overlay-root');
        const shadow = root.shadowRoot;
        const btnBack = shadow.getElementById('btn-back');

        // Click is async now
        btnBack.click();

        // Wait for microtasks
        await Promise.resolve();
        await Promise.resolve();

        expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'navigate_back' })
        );

        // Advance timers past the fallback window
        jest.advanceTimersByTime(600);

        // Location should NOT be about:blank because it succeeded
        expect(window.location.href).not.toBe('about:blank');

        // Overlay should be removed
        expect(document.getElementById('hydra-guard-overlay-root')).toBeNull();
    });
});
