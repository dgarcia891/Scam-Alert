import { jest, describe, beforeEach, it, expect } from '@jest/globals';

/**
 * Storage Service Tests
 * 
 * Tests chrome.storage.local wrapper functions
 */

import { getSettings, updateSettings, updateStats, getCachedScan, cacheScan, isWhitelisted, normalizeUrl } from '../../src/lib/storage';

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
                phishTankApiKey: '',
                licenseKey: '',
                planType: 'free',
                emailScanningEnabled: true,
                emailPromptDisabled: false,
                aiEnabled: false,
                aiApiKey: '',
                aiDailyCeiling: 50
            });
        });

        it('should return stored settings merged with defaults', async () => {
            const mockSettings = { scanningEnabled: false };
            chrome.storage.local.get.mockResolvedValue({ settings: mockSettings });

            const settings = await getSettings();

            expect(settings).toEqual({
                scanningEnabled: false, // overridden
                notificationsEnabled: true,
                notifyOnHttpWarning: false,
                collectPageSignals: false,
                useGoogleSafeBrowsing: true,
                usePhishTank: false,
                usePatternDetection: true,
                preferOffline: false,
                gsbApiKey: '',
                phishTankApiKey: '',
                licenseKey: '',
                planType: 'free',
                emailScanningEnabled: true,
                emailPromptDisabled: false,
                aiEnabled: false,
                aiApiKey: '',
                aiDailyCeiling: 50
            });
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
                settings: expect.objectContaining({ ...existing, ...updates })
            });
        });
    });

    describe('updateStats with Metadata', () => {
        it('should store metadata in recentActivity', async () => {
            const update = {
                scan: true,
                activity: {
                    domain: 'mail.google.com',
                    action: 'scanned',
                    metadata: { subject: 'Test' }
                }
            };
            chrome.storage.local.get.mockResolvedValue({ statistics: { recentActivity: [] } });
            chrome.storage.local.set.mockResolvedValue(undefined);

            await updateStats(update);

            const call = chrome.storage.local.set.mock.calls[0][0];
            expect(call.statistics.recentActivity[0].metadata).toEqual({ subject: 'Test' });
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
                    result: data,
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
                [`scan_cache_${normalized}`]: { result: data, timestamp }
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

        it('should return true for whitelisted email address', async () => {
            chrome.storage.local.get.mockResolvedValue({
                whitelist: ['trusted@example.com']
            });

            const result = await isWhitelisted('trusted@example.com');

            expect(result).toBe(true);
        });

        it('should return true if email domain is whitelisted', async () => {
            chrome.storage.local.get.mockResolvedValue({
                whitelist: ['example.com']
            });

            const result = await isWhitelisted('anyone@example.com');

            expect(result).toBe(true);
        });
    });
});
