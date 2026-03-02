import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { applyInPageHighlighting, _resetTooltipManager } from '../../extension/src/content/email/tooltip.js';
import { MessageTypes } from '../../extension/src/lib/messaging.js';
import { chrome } from 'jest-chrome';

describe('BUG-073: Interactive Highlighting & Reporting', () => {

    beforeEach(() => {
        document.body.innerHTML = '';
        _resetTooltipManager();
        jest.clearAllMocks();

        // Mock chrome.runtime.sendMessage to simulate success
        chrome.runtime.sendMessage.mockImplementation((message, callback) => {
            if (callback) callback({ success: true });
        });

        // Mock window.location
        Object.defineProperty(window, 'location', {
            value: { href: 'https://mail.google.com/test' },
            writable: true
        });
    });

    afterEach(() => {
        _resetTooltipManager();
        document.body.innerHTML = '';
    });

    const mockResult = {
        checks: {
            'urgency_scam_01': {
                flagged: true,
                severity: 'HIGH',
                title: 'High Urgency Detected',
                details: 'Immerse pressure language found.',
                type: 'urgency',
                matches: ['action required immediately']
            }
        }
    };

    function setupDOM(text) {
        const div = document.createElement('div');
        div.textContent = text;
        document.body.appendChild(div);
        return div;
    }

    test('Range API correctly wraps text nodes with issue IDs', () => {
        setupDOM('This is a test. Wait, action required immediately to fix this.');

        applyInPageHighlighting(mockResult);

        const highlightSpans = document.querySelectorAll('span.hydra-guard-highlight');
        expect(highlightSpans.length).toBe(1);

        const span = highlightSpans[0];
        expect(span.textContent).toBe('action required immediately');
        expect(span.getAttribute('data-scam-issue-id')).toBe('scam-issue-1');

        // Ensure Shadow DOM host is injected
        expect(document.getElementById('hydra-guard-tooltip-root')).not.toBeNull();
    });

    test('Tooltip interaction states (Hover, Click Lock, Form Submit)', async () => {
        setupDOM('action required immediately');
        applyInPageHighlighting(mockResult);

        const span = document.querySelector('.hydra-guard-highlight');
        const overlayRoot = document.getElementById('hydra-guard-tooltip-root');
        const shadow = overlayRoot.shadowRoot;
        const tooltip = shadow.querySelector('.tooltip');

        // 1. Hover
        span.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        expect(tooltip.classList.contains('visible')).toBe(true);
        expect(shadow.getElementById('tt-header').textContent).toBe('High Urgency Detected');

        span.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
        expect(tooltip.classList.contains('visible')).toBe(false);

        // 2. Click Lock
        span.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(tooltip.classList.contains('visible')).toBe(true);

        span.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
        // Should STILL be visible because it's locked by click
        expect(tooltip.classList.contains('visible')).toBe(true);

        // 3. Form Expand
        const btnReport = shadow.getElementById('btn-report');
        btnReport.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        const form = shadow.getElementById('tt-form');
        expect(form.classList.contains('active')).toBe(true);

        // 4. Form Submit & Validation
        const textarea = shadow.getElementById('fp-reason');
        const btnSubmit = shadow.getElementById('btn-submit');

        // Too short
        textarea.value = 'Not a scam';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        expect(btnSubmit.disabled).toBe(true);

        // Valid length
        textarea.value = 'This is a normal email from my boss, not a scam.';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        expect(btnSubmit.disabled).toBe(false);

        // Submit
        btnSubmit.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        // Yield to let async listeners execute fully in JSDOM
        for (let i = 0; i < 5; i++) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        // Verify Payload Contract
        expect(global.chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
        const [message] = global.chrome.runtime.sendMessage.mock.calls[0];

        expect(message.type).toBe(MessageTypes.REPORT_FALSE_POSITIVE);
        expect(message.data).toMatchObject({
            issueId: 'scam-issue-1',
            ruleId: 'urgency_scam_01',
            issueType: 'urgency',
            severity: 'HIGH',
            phrase: 'action required immediately',
            explanation: 'This is a normal email from my boss, not a scam.',
            url: 'https://mail.google.com/test'
        });
        expect(message.data.timestamp).toBeDefined();
    });

    test('ESC globally closes locked tooltip', () => {
        setupDOM('action required immediately');
        applyInPageHighlighting(mockResult);

        const span = document.querySelector('.hydra-guard-highlight');
        const tooltip = document.getElementById('hydra-guard-tooltip-root').shadowRoot.querySelector('.tooltip');

        // Lock
        span.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(tooltip.classList.contains('visible')).toBe(true);

        // ESC
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(tooltip.classList.contains('visible')).toBe(false);
    });
});
