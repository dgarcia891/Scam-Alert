import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { getCachedScan, cacheScan } from '../../src/lib/storage.js';

describe('BUG-076: Detection Cache Backend Schema Regression', () => {
    beforeEach(() => {
        // Clear storage mocks
        chrome.storage.local.get.mockClear();
        chrome.storage.local.set.mockClear();
        chrome.storage.local.remove.mockClear();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('getCachedScan normalizes legacy severity to overallSeverity', async () => {
        const url = 'http://legacy-scam.com';
        const legacyData = {
            severity: 'HIGH',
            confidence: 'HIGH',
            action: 'WARN_OVERLAY',
            reasons: [],
            signals: { hard: [], soft: [] },
            checks: {},
            meta: { timestamp: Date.now() - 1000 }
        };

        // Mock chrome.storage.local.get to return legacy data directly without callback parsing if using Promises
        // Wait, storage.js uses callback for getWhitelist but await chrome.storage.local.get for getCachedScan
        chrome.storage.local.get.mockResolvedValueOnce({
            [`scan_cache_http://legacy-scam.com/`]: {
                result: legacyData,
                timestamp: Date.now() - 1000
            }
        });

        const result = await getCachedScan(url);

        expect(result).toBeDefined();
        // The fix should have normalized these fields
        expect(result.overallSeverity).toBe('HIGH');
        expect(result.overallThreat).toBe(true);
        expect(result.severity).toBe('HIGH');
    });

    test('getCachedScan preserves canonical schemas', async () => {
        const url = 'http://modern-scam.com';
        const modernData = {
            severity: 'MEDIUM',
            overallSeverity: 'MEDIUM',
            overallThreat: false,
            confidence: 'MEDIUM',
            action: 'WARN_POPUP',
            reasons: [],
            signals: { hard: [], soft: [] },
            checks: {},
            meta: { timestamp: Date.now() - 1000 }
        };

        chrome.storage.local.get.mockResolvedValueOnce({
            [`scan_cache_http://modern-scam.com/`]: {
                result: modernData,
                timestamp: Date.now() - 1000
            }
        });

        const result = await getCachedScan(url);

        expect(result).toBeDefined();
        expect(result.overallSeverity).toBe('MEDIUM');
        expect(result.overallThreat).toBe(false);
    });
});
