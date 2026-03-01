/**
 * BUG-059: Ghost Badge Regression Test
 * 
 * Verifies that syncIconForTabFromCache also updates tabStateManager
 * to prevent mismatch between icon and popup.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { syncIconForTabFromCache } from '../../extension/src/background/lib/icon-manager.js';
import { tabStateManager } from '../../extension/src/lib/tab-state-manager.js';

describe('BUG-059: Ghost Badge Discrepancy', () => {
    let mockChrome;

    beforeEach(() => {
        mockChrome = {
            action: {
                setBadgeText: jest.fn(),
                setBadgeBackgroundColor: jest.fn(),
                setIcon: jest.fn()
            },
            storage: {
                local: {
                    get: jest.fn(),
                    set: jest.fn(),
                    remove: jest.fn()
                }
            },
            runtime: {
                getURL: jest.fn(path => `chrome-extension://mock/${path}`)
            }
        };
        global.chrome = mockChrome;
        jest.clearAllMocks();
    });

    it('should update tabStateManager when syncing icon from cache', async () => {
        const tabId = 123;
        const url = 'https://warning-site.com';
        const cachedResult = {
            overallSeverity: 'MEDIUM',
            overallThreat: false,
            detections: { pattern: { title: 'Suspicious site' } }
        };

        // Mock chrome.storage.local.get to return a cached scan
        // storage.js uses keys like 'scan_cache_https://warning-site.com'
        mockChrome.storage.local.get.mockImplementation((key) => {
            if (typeof key === 'string' && key.startsWith('scan_cache_')) {
                return Promise.resolve({
                    [key]: {
                        result: cachedResult,
                        timestamp: Date.now()
                    }
                });
            }
            return Promise.resolve({});
        });

        // Helper to check if URL should be scanned (true for our test)
        const shouldScanUrl = () => true;

        await syncIconForTabFromCache(tabId, url, shouldScanUrl, tabStateManager);

        // Badge should be set to '!'
        expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({ tabId, text: '!' });

        // tabStateManager should be updated
        const state = tabStateManager.getTabState(tabId);
        expect(state.scanResults).toEqual(cachedResult);
        expect(state.url).toBe(url);
    });
});
