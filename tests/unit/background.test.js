import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { handleIncomingMessage } from '../../src/background/lib/message-dispatcher.js';
import { severityToIconState, shouldShowHttpNotification } from '../../src/background/lib/icon-manager.js';
import { createNavigationHandler } from '../../src/background/lib/navigation-handler.js';
import { MessageTypes } from '../../src/lib/messaging.js';

describe('Background Module - Severity to Icon Mapping', () => {
    it('maps CRITICAL and HIGH to DANGER', () => {
        expect(severityToIconState('CRITICAL')).toBe('DANGER');
        expect(severityToIconState('HIGH')).toBe('DANGER');
    });

    it('maps MEDIUM to WARNING', () => {
        expect(severityToIconState('MEDIUM')).toBe('WARNING');
    });

    it('maps LOW to SAFE', () => {
        expect(severityToIconState('LOW')).toBe('SAFE');
    });

    it('maps SAFE and others to SAFE', () => {
        expect(severityToIconState('SAFE')).toBe('SAFE');
        expect(severityToIconState('UNKNOWN')).toBe('SAFE');
    });
});

describe('Background Module - HTTP Notification Throttling', () => {
    it('allows first notification for a URL', () => {
        expect(shouldShowHttpNotification('http://example.com/1')).toBe(true);
    });

    it('throttles subsequent notifications within TTL', () => {
        const url = 'http://example.com/2';
        expect(shouldShowHttpNotification(url)).toBe(true);
        expect(shouldShowHttpNotification(url)).toBe(false);
    });
});

describe('Background Module - Navigation Handler (Wrapper)', () => {
    it('calls scanAndHandle for main frame navigations and clears badge', async () => {
        const scanAndHandle = jest.fn();
        const shouldScanUrl = jest.fn().mockReturnValue(true);

        // Mock chrome.action
        global.chrome = {
            action: {
                setBadgeText: jest.fn().mockResolvedValue(undefined)
            }
        };

        const handler = createNavigationHandler({ shouldScanUrl, scanAndHandle });

        await handler({ frameId: 0, url: 'https://test.com', tabId: 123 });

        expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ tabId: 123, text: '' });
        expect(shouldScanUrl).toHaveBeenCalledWith('https://test.com');
        expect(scanAndHandle).toHaveBeenCalledWith(123, 'https://test.com');
    });

    it('ignores subframe navigations', async () => {
        const scanAndHandle = jest.fn();
        const handler = createNavigationHandler({ scanAndHandle });

        await handler({ frameId: 1, url: 'https://test.com', tabId: 123 });

        expect(scanAndHandle).not.toHaveBeenCalled();
    });
});
