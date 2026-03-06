import { describe, test, expect, jest, beforeEach, afterEach, beforeAll } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const contentSrc = (rel) => resolve(__dirname, '../../extension/src/content', rel);
const libSrc = (rel) => resolve(__dirname, '../../extension/src/lib', rel);

let createOverlay;

beforeAll(async () => {
    jest.unstable_mockModule(libSrc('messaging.js'), () => ({
        MessageTypes: {
            CONTEXT_DETECTED: 'context_detected', SCAN_RESULT: 'scan_result',
            SCAN_RESULT_UPDATED: 'scan_result_updated', SHOW_WARNING: 'show_warning',
            HIDE_WARNING: 'hide_warning', SHOW_BANNER: 'show_banner',
            OPEN_REPORT_MODAL: 'open_report_modal', EXECUTE_SCAN: 'execute_scan',
            SCAN_PROGRESS: 'scan_progress', REPORT_SCAM: 'report_scam',
            ANALYZE_PAGE: 'analyze_page', NAVIGATE_BACK: 'navigate_back'
        }
    }));
    jest.unstable_mockModule(libSrc('context-detector.js'), () => ({
        detectContext: () => ({ type: 'web' }),
        detectEmailMetadata: () => null
    }));
    jest.unstable_mockModule(libSrc('detector.js'), () => ({
        scanUrl: jest.fn().mockResolvedValue({ overallSeverity: 'SAFE' })
    }));
    jest.unstable_mockModule(contentSrc('highlighter.js'), () => ({
        highlightDetections: jest.fn(),
        removeHighlights: jest.fn()
    }));

    const mod = await import('../../extension/src/content/content.js');
    createOverlay = mod.createOverlay;
});

describe('BUG-075: "Go back to safety" Button Fallback Navigation', () => {
    let originalHistory;
    let originalLocation;

    beforeEach(() => {
        document.documentElement.innerHTML = '<head></head><body></body>';
        jest.useFakeTimers();

        originalHistory = window.history;
        originalLocation = window.location;

        delete window.location;
        window.location = { href: 'https://malicious-site.com' };

        delete window.history;
        window.history = { length: 1, back: jest.fn() };
        window.close = jest.fn();

        if (window.sessionStorage) window.sessionStorage.clear();
    });

    afterEach(() => {
        jest.useRealTimers();
        window.history = originalHistory;
        window.location = originalLocation;
    });

    test('Button sends NAVIGATE_BACK message and fallbacks after 500ms', () => {
        global.chrome = {
            runtime: {
                sendMessage: jest.fn(),
                getURL: (path) => path
            }
        };

        createOverlay({
            recommendations: ['Danger'],
            checks: { phishing: { details: 'Phishing domain' } }
        });

        const root = document.getElementById('hydra-guard-overlay-root');
        const shadow = root.shadowRoot;
        const btnBack = shadow.getElementById('btn-back');

        btnBack.click();

        expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: 'navigate_back'
        }));

        jest.advanceTimersByTime(501);
        expect(window.location.href).toBe('about:blank');
    });
});
