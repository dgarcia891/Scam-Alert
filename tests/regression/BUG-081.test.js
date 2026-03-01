import { jest } from '@jest/globals';
import { MessageTypes } from '../../extension/src/lib/messaging.js';
import { handleIncomingMessage } from '../../extension/src/background/messages/handler.js';

describe('BUG-081 Regression: Robust Navigation', () => {
    let mockGoBack;

    beforeEach(() => {
        jest.clearAllMocks();
        mockGoBack = jest.fn().mockResolvedValue(true);
        global.chrome = {
            tabs: {
                goBack: mockGoBack
            },
            runtime: {
                getURL: (path) => path
            }
        };
    });

    test('should trigger chrome.tabs.goBack when NAVIGATE_BACK message is received', async () => {
        const message = { type: MessageTypes.NAVIGATE_BACK };
        const sender = { tab: { id: 123 } };
        const context = {};

        const response = await handleIncomingMessage(message, sender, context);

        expect(mockGoBack).toHaveBeenCalledWith(123);
        expect(response).toEqual({ success: true });
    });

    test('should return error if tab ID is missing', async () => {
        const message = { type: MessageTypes.NAVIGATE_BACK };
        const sender = {}; // No tab
        const context = {};

        const response = await handleIncomingMessage(message, sender, context);

        expect(mockGoBack).not.toHaveBeenCalled();
        expect(response).toEqual({ error: 'No tab ID' });
    });
});
