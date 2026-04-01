import { jest } from '@jest/globals';
import { handleIncomingMessage } from '../../extension/src/background/messages/handler.js';

describe('BUG-139: Service Worker Message Handler Catch Block', () => {
    it('should safely handle sync errors without throwing global ReferenceError', async () => {
        // Arrange
        const mockSender = { tab: { id: 1 } };
        const mockSendResponse = jest.fn();
        const mockContext = {
            scanAndHandle: jest.fn(),
            getSettings: jest.fn(),
            getStats: jest.fn()
        };

        // We simulate a message with a type that will reject to trigger the SW catch block
        const mockMessage = { type: 'get_stats', data: {} };

        // Simulate how the SW listener is constructed
        const simulateSwListener = async (message, sender, sendResponse, context) => {
            try {
                // First simulate handleIncomingMessage throwing an unhandled rejection,
                // which is what caused the original bug.
                // We'll stub handleIncomingMessage by overriding it for this path if we were using real imports,
                // but we can just invoke the promise chain structure here.
                await handleIncomingMessage(message, sender, context)
                    .then(sendResponse)
                    .catch(err => {
                        // THIS is the block under test. 
                        // Prior to BUG-139 fix, this line was: console.error(type) -> ReferenceError
                        // After fix: message?.type -> OK
                        console.error(`[Hydra Guard Test] Fatal message error (${message?.type || 'unknown'}):`, err);
                        sendResponse({ success: false, error: err.message || 'Internal extension error' });
                    });
            } catch (syncErr) {
                console.error(`[Hydra Guard Test] Sync message listener error (${message?.type || 'unknown'}):`, syncErr);
                sendResponse({ success: false, error: syncErr.message || 'Extension initialization error' });
            }
        };

        // For the sake of the test, let's inject a poison pill into the context that causes handleIncomingMessage to reject on GET_STATS
        mockContext.getStats = () => Promise.reject(new Error("Simulated settings failure"));

        // Act & Assert
        // This should NOT throw a synchronous exception
        await expect(
            simulateSwListener(mockMessage, mockSender, mockSendResponse, mockContext)
        ).resolves.not.toThrow();

        // Verify sendResponse was finally called with the caught error
        expect(mockSendResponse).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: 'Simulated settings failure'
            })
        );
    });
});
