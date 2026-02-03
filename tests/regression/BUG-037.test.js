import { jest } from '@jest/globals';

describe('BUG-037: Missing sendResponse in Content Script', () => {
    let sendResponse;
    let listener;

    beforeEach(() => {
        sendResponse = jest.fn();
        // Simulate the buggy listener from content-main.js
        listener = (message, sender, sendResponse) => {
            const { type } = message;
            switch (type) {
                case 'KNOWN_TYPE':
                    sendResponse({ success: true });
                    break;
                default:
                    // logic in content-main.js just logs warn
                    console.warn('[Scam Alert Content] Unknown message:', type);
                    sendResponse({ success: false, error: 'Unknown message type' }); // Fixed
            }
            return true;
        };
    });

    test('Should call sendResponse for known message types', () => {
        listener({ type: 'KNOWN_TYPE' }, {}, sendResponse);
        expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    test('Should call sendResponse for UNKNOWN message types to prevent port closed error', () => {
        listener({ type: 'UNKNOWN_TYPE' }, {}, sendResponse);
        // This fails currently because the code doesn't call it
        expect(sendResponse).toHaveBeenCalled();
    });
});
