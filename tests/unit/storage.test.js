import { jest, describe, beforeEach, it, expect } from '@jest/globals';

/**
 * Storage Service Tests
 * 
 * Tests chrome.storage.local wrapper functions
 */

import { getSettings, updateSettings, getCachedScan, cacheScan, isWhitelisted, normalizeUrl } from '../../src/lib/storage';

describe('Storage Service', () => {

    beforeEach(() => {
        // Clear storage mock
        chrome.storage.local.get.mockClear();
        chrome.storage.local.set.mockClear();
    });

    describe('getSettings', () => {
        it('should return default settings when none exist', async () => {
            chrome.storage.local.get.mockResolvedValue({});

            const settings = await getSettings();

            expect(settings).toEqual({
                scanningEnabled: true,
                notificationsEnabled: true,
                notifyOnHttpWarning: false,
                collectPageSignals: false,
                useGoogleSafeBrowsing: true,
                usePhishTank: false,
                usePatternDetection: true,
                preferOffline: false,
                gsbApiKey: '',
                phishTankApiKey: ''
            });
        });

        it('should return stored settings', async () => {
            const mockSettings = { scanningEnabled: false };
            chrome.storage.local.get.mockResolvedValue({ settings: mockSettings });

            const settings = await getSettings();

            expect(settings).toEqual(mockSettings);
        });
    });

    describe('updateSettings', () => {
        it('should merge new settings with existing', async () => {
            const existing = {
                scanningEnabled: true,
                notificationsEnabled: true,
                notifyOnHttpWarning: false,
                collectPageSignals: false
            };
            const updates = { scanningEnabled: false };

            chrome.storage.local.get.mockResolvedValue({ settings: existing });
            chrome.storage.local.set.mockResolvedValue(undefined);

            await updateSettings(updates);

            expect(chrome.storage.local.set).toHaveBeenCalledWith({
                settings: { ...existing, ...updates }
            });
        });
    });

    describe('cacheScan', () => {
        it('should store scan result with timestamp', async () => {
            const url = 'https://example.com';
            const data = { safe: true };

            chrome.storage.local.set.mockResolvedValue(undefined);

            await cacheScan(url, data);

            const normalized = normalizeUrl(url);
            expect(chrome.storage.local.set).toHaveBeenCalledWith({
                [`scan_cache_${normalized}`]: {
                    data,
                    timestamp: expect.any(Number)
                }
            });
        });
    });

    describe('getCachedScan', () => {
        it('should return cached result if fresh', async () => {
            const url = 'https://example.com';
            const data = { safe: true };
            const timestamp = Date.now();

            const normalized = normalizeUrl(url);
            chrome.storage.local.get.mockResolvedValue({
                [`scan_cache_${normalized}`]: { data, timestamp }
            });

            const result = await getCachedScan(url);

            expect(result).toEqual(data);
        });

        it('should return null if cache expired', async () => {
            const url = 'https://example.com';
            const data = { safe: true };
            const timestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago

            const normalized = normalizeUrl(url);
            chrome.storage.local.get.mockResolvedValue({
                [`scan_cache_${normalized}`]: { data, timestamp }
            });
            chrome.storage.local.remove.mockResolvedValue(undefined);

            const result = await getCachedScan(url);

            expect(result).toBeNull();
            expect(chrome.storage.local.remove).toHaveBeenCalled();
        });
    });

    describe('isWhitelisted', () => {
        it('should return true for whitelisted domain', async () => {
            chrome.storage.local.get.mockResolvedValue({
                whitelist: ['example.com', 'google.com']
            });

            const result = await isWhitelisted('https://www.example.com/page');

            expect(result).toBe(true);
        });

        it('should return false for non-whitelisted domain', async () => {
            chrome.storage.local.get.mockResolvedValue({
                whitelist: ['example.com']
            });

            const result = await isWhitelisted('https://malicious.com');

            expect(result).toBe(false);
        });
    });
});
