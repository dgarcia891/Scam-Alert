import { jest } from '@jest/globals';

import { addToBlocklist, removeFromBlocklist, getBlocklist, isBlocked } from '../../src/lib/storage.js';

describe('Blocklist Storage', () => {
    beforeEach(() => {
        chrome.storage.local.get.mockClear();
        chrome.storage.local.set.mockClear();
    });

    test('should add domain to blocklist', async () => {
        // Setup initial empty state
        chrome.storage.local.get.mockResolvedValue({ blocklist: [] });

        await addToBlocklist('example.com');

        expect(chrome.storage.local.set).toHaveBeenCalledWith({
            blocklist: ['example.com']
        });
    });

    test('should not add duplicate domain', async () => {
        chrome.storage.local.get.mockResolvedValue({ blocklist: ['example.com'] });

        await addToBlocklist('example.com');

        expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    test('should remove domain from blocklist', async () => {
        chrome.storage.local.get.mockResolvedValue({ blocklist: ['example.com', 'test.com'] });

        await removeFromBlocklist('example.com');

        expect(chrome.storage.local.set).toHaveBeenCalledWith({
            blocklist: ['test.com']
        });
    });

    test('should return true for blocked domain', async () => {
        chrome.storage.local.get.mockResolvedValue({ blocklist: ['example.com'] });

        const result = await isBlocked('https://example.com/foo');
        expect(result).toBe(true);
    });

    test('should return true for subdomain of blocked domain', async () => {
        chrome.storage.local.get.mockResolvedValue({ blocklist: ['example.com'] });

        const result = await isBlocked('https://sub.example.com/foo');
        expect(result).toBe(true);
    });

    test('should return false for non-blocked domain', async () => {
        chrome.storage.local.get.mockResolvedValue({ blocklist: ['example.com'] });

        const result = await isBlocked('https://google.com');
        expect(result).toBe(false);
    });
});
