import { jest } from '@jest/globals';
import { setupEmailObserver } from '../../extension/src/content/email/mutation-observer.js';
import { OVERLAY_ID } from '../../extension/src/content/content.js';

describe('BUG-084: MutationObserver must not rescan when overlay is active', () => {
    let triggerScan;
    let observer;

    beforeEach(() => {
        jest.useFakeTimers();
        triggerScan = jest.fn();
        document.body.innerHTML = '';
        document.getElementById(OVERLAY_ID)?.remove();
    });

    afterEach(() => {
        observer?.disconnect();
        document.getElementById(OVERLAY_ID)?.remove();
        jest.useRealTimers();
    });

    test('should NOT trigger a rescan when a mutation occurs while the overlay is visible', async () => {
        // Simulate overlay present on the page (appended to documentElement, as content.js does)
        const overlayContainer = document.createElement('div');
        overlayContainer.id = OVERLAY_ID;
        document.documentElement.appendChild(overlayContainer);

        observer = setupEmailObserver(triggerScan);

        // Simulate a DOM mutation (e.g., Gmail updating its UI while overlay is open)
        const div = document.createElement('div');
        document.body.appendChild(div);

        // Flush MutationObserver microtask queue
        await Promise.resolve();

        // Advance past the 1000ms debounce
        jest.advanceTimersByTime(1500);

        // Because overlay is present, triggerScan should be suppressed
        expect(triggerScan).not.toHaveBeenCalled();
    });
});
