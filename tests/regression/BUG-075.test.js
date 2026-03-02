import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { createOverlay } from '../../extension/src/content/content.js';

describe('BUG-075: "Go back to safety" Button Fallback Navigation', () => {
    let originalHistory;
    let originalLocation;

    beforeEach(() => {
        document.body.innerHTML = '';
        jest.useFakeTimers();

        // Save originals
        originalHistory = window.history;
        originalLocation = window.location;

        // Mock window.location
        delete window.location;
        window.location = { href: 'https://malicious-site.com' };

        // Mock history
        delete window.history;
        window.history = { length: 1, back: jest.fn() };
        window.close = jest.fn();
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

        // Should call background script
        expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: 'navigate_back'
        }));

        // Advance timers to trigger the fallback (500ms)
        jest.advanceTimersByTime(501);

        expect(window.location.href).toBe('about:blank');
    });
});
