import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { createOverlay } from '../../src/content/content.js';

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

    test('Button navigates to about:blank when history length is 1', () => {
        createOverlay({
            recommendations: ['Danger'],
            checks: { phishing: { details: 'Phishing domain' } }
        });

        const root = document.getElementById('scam-alert-overlay-root');
        const shadow = root.shadowRoot;
        const btnBack = shadow.getElementById('btn-back');

        btnBack.click();

        // Should not call back because length <= 1
        expect(window.history.back).not.toHaveBeenCalled();

        // Advance timers to trigger the fallback
        jest.advanceTimersByTime(200);

        expect(window.location.href).toBe('about:blank');
    });

    test('Button attempts to use history.back if history length > 1', () => {
        window.history.length = 5;

        createOverlay({
            recommendations: ['Danger'],
            checks: { phishing: { details: 'Phishing domain' } }
        });

        const root = document.getElementById('scam-alert-overlay-root');
        const shadow = root.shadowRoot;
        const btnBack = shadow.getElementById('btn-back');

        btnBack.click();

        // Should call back because length > 1
        expect(window.history.back).toHaveBeenCalled();

        // Advance timers to trigger the fallback
        jest.advanceTimersByTime(200);

        expect(window.location.href).toBe('about:blank');
    });
});
