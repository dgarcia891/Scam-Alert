import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';

// 1. Setup global mock BEFORE any other imports to handle ESM hoisting
// We use Object.assign to avoid overwriting the whole object if jest-chrome is active
if (!global.chrome) global.chrome = {};
Object.assign(global.chrome, {
    tabs: {
        query: jest.fn().mockResolvedValue([{ id: 123, url: 'https://example.com' }])
    },
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn(),
            remove: jest.fn()
        }
    },
    action: {
        setBadgeText: jest.fn()
    },
    runtime: {
        getURL: jest.fn((path) => `chrome-extension://mock-id/${path}`)
    },
    notifications: {
        create: jest.fn()
    }
});

import { handleIncomingMessage } from '../../../extension/src/background/messages/handler.js';
import { MessageTypes } from '../../../extension/src/lib/messaging.js';

describe('Background Message Routing (Refactored)', () => {
    const mockContext = {
        scanAndHandle: jest.fn(),
        getStats: jest.fn(),
        updateSettings: jest.fn(),
        getCachedScan: jest.fn(),
        addToWhitelist: jest.fn(),
        repairStatistics: jest.fn(),
        getWhitelist: jest.fn().mockReturnValue([]),
        submitReport: jest.fn()
    };
    const mockSender = { tab: { id: 123, url: 'https://example.com' } };

    beforeEach(() => {
        jest.clearAllMocks();
        global.chrome.tabs.query.mockResolvedValue([{ id: 123, url: 'https://example.com' }]);
    });

    it('routes GET_TAB_STATUS correctly', async () => {
        const response = await handleIncomingMessage({ type: MessageTypes.GET_TAB_STATUS }, mockSender, mockContext);
        expect(response).toBeDefined();
    });

    it('routes SCAN_CURRENT_TAB correctly', async () => {
        await handleIncomingMessage({
            type: MessageTypes.SCAN_CURRENT_TAB,
            data: { forceRefresh: true }
        }, mockSender, mockContext);
        expect(mockContext.scanAndHandle).toHaveBeenCalled();
    });

    it('routes UPDATE_SETTINGS correctly', async () => {
        await handleIncomingMessage({
            type: MessageTypes.UPDATE_SETTINGS,
            data: { enabled: true }
        }, mockSender, mockContext);
        expect(mockContext.updateSettings).toHaveBeenCalledWith({ enabled: true });
    });

    it('routes ADD_TO_WHITELIST correctly', async () => {
        await handleIncomingMessage({
            type: MessageTypes.ADD_TO_WHITELIST,
            data: { domain: 'google.com' }
        }, mockSender, mockContext);
    });

    it('returns error for unknown message types', async () => {
        const response = await handleIncomingMessage({ type: 'UNKNOWN_MSG' }, mockSender, mockContext);
        expect(response.error).toBe('Unknown message type');
    });
});
