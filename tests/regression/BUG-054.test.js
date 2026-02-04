/**
 * BUG-054: Regression test for "No tab with id" errors
 * 
 * Context: Users experiencing "Uncaught (in promise) Error: No tab with id: XXXXXX"
 * Root Cause: sendMessageToTab doesn't handle the "No tab with id" error message
 * 
 * This test ensures the messaging layer gracefully handles closed/invalid tabs.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { sendMessageToTab } from '../../src/lib/messaging.js';

describe('BUG-054: Tab ID Error Handling', () => {
    beforeEach(() => {
        global.chrome = {
            tabs: {
                sendMessage: jest.fn()
            },
            runtime: {
                lastError: null
            }
        };
    });

    it('should gracefully handle "No tab with id" error', async () => {
        // Simulate Chrome's error when tab doesn't exist
        global.chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
            global.chrome.runtime.lastError = { message: 'No tab with id: 196245929' };
            callback(undefined);
        });

        const result = await sendMessageToTab(196245929, { type: 'test' });

        // Should resolve to null instead of throwing
        expect(result).toBeNull();
    });

    it('should gracefully handle "Receiving end does not exist" error', async () => {
        global.chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
            global.chrome.runtime.lastError = { message: 'Receiving end does not exist' };
            callback(undefined);
        });

        const result = await sendMessageToTab(123, { type: 'test' });
        expect(result).toBeNull();
    });

    it('should gracefully handle "Could not establish connection" error', async () => {
        global.chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
            global.chrome.runtime.lastError = { message: 'Could not establish connection' };
            callback(undefined);
        });

        const result = await sendMessageToTab(123, { type: 'test' });
        expect(result).toBeNull();
    });

    it('should reject on other runtime errors', async () => {
        global.chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
            global.chrome.runtime.lastError = { message: 'Permission denied' };
            callback(undefined);
        });

        await expect(sendMessageToTab(123, { type: 'test' })).rejects.toThrow('Permission denied');
    });

    it('should resolve successfully when no error occurs', async () => {
        const mockResponse = { success: true, data: 'test' };
        global.chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
            global.chrome.runtime.lastError = null;
            callback(mockResponse);
        });

        const result = await sendMessageToTab(123, { type: 'test' });
        expect(result).toEqual(mockResponse);
    });
});
