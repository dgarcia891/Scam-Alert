import { jest } from '@jest/globals';
import { createOverlay } from '../../src/content/content.js';

describe('BUG-082: SPA Back Navigation Fallback', () => {
    let mockSendMessage;

    beforeEach(() => {
        document.body.innerHTML = '';
        jest.useFakeTimers();

        mockSendMessage = jest.fn().mockResolvedValue({ success: true });

        global.chrome = {
            runtime: {
                sendMessage: mockSendMessage,
                getURL: (path) => path
            }
        };

        // Mock window.location and history
        delete window.location;
        window.location = { href: 'https://mail.google.com/mail/u/0/#inbox' };

        delete window.history;
        window.history = { length: 5 };
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('Overlay is removed and fallback is cancelled if NAVIGATE_BACK succeeds', async () => {
        createOverlay({
            recommendations: ['Danger'],
            checks: { phishing: { details: 'Phishing domain' } }
        });

        const root = document.getElementById('scam-alert-overlay-root');
        const shadow = root.shadowRoot;
        const btnBack = shadow.getElementById('btn-back');

        // Click is async now, so we need to wait for the microtasks
        const clickPromise = btnBack.click();

        // Wait for all promises (like our mocked sendMessage) to resolve
        await Promise.resolve();
        await Promise.resolve(); // extra tick just to be safe for microtasks

        expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'navigate_back' })
        );

        // Advance timers past the fallback window
        jest.advanceTimersByTime(600);

        // Location should NOT be about:blank because it succeeded
        expect(window.location.href).not.toBe('about:blank');

        // Overlay should be removed so user can see the previous SPA state
        expect(document.getElementById('scam-alert-overlay-root')).toBeNull();
    });
});
