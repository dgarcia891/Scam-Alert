import { jest, describe, beforeEach, test, expect } from '@jest/globals';
import { createNavigationHandler } from '../../extension/src/background/lib/navigation-handler.js';

describe('BUG-062 Navigation Badge Flicker', () => {
    let mockContext;
    let navHandler;

    beforeEach(() => {
        mockContext = {
            shouldScanUrl: jest.fn(() => true),
            scanAndHandle: jest.fn(() => Promise.resolve()),
            syncIconForTabFromCache: jest.fn(() => Promise.resolve()),
            tabStateManager: {}
        };

        // Mock Chrome Action API
        global.chrome = {
            action: {
                setBadgeText: jest.fn(() => Promise.resolve()),
                setBadgeBackgroundColor: jest.fn(() => Promise.resolve())
            }
        };

        navHandler = createNavigationHandler(mockContext);
    });

    test('onBeforeNavigate should clear badge immediately', async () => {
        const details = {
            frameId: 0,
            tabId: 123,
            url: 'https://example.com'
        };

        await navHandler(details);

        // Verification: setBadgeText should be called with empty string BEFORE/DURING navigation
        expect(chrome.action.setBadgeText).toHaveBeenCalledWith({
            tabId: 123,
            text: ''
        });
    });
});
