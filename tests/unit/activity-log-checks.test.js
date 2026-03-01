/**
 * Unit Test for Activity Log Detailed Checks
 * Verifies that the `checks` object is correctly passed through createScanResult
 * and populated by the detector layer.
 */
import { describe, it, expect, jest } from '@jest/globals';
import { scanUrl } from '../../extension/src/lib/detector.js';

describe('Activity Log - Detailed Checks (Bug-066 / Enhancement)', () => {
    it('should include full checks object in scan result', async () => {
        // Setup mock for chrome.storage.local
        global.chrome = {
            storage: {
                local: {
                    get: jest.fn().mockResolvedValue({}),
                    set: jest.fn().mockResolvedValue({})
                }
            }
        };

        // Mock GSB/PhishTank
        const options = {
            useGoogleSafeBrowsing: false,
            usePhishTank: false,
            usePatternDetection: true
        };

        const result = await scanUrl('http://paypal-security-update.com', options);

        // Verify the canonical schema fields
        expect(result.checks).toBeDefined();
        expect(typeof result.checks).toBe('object');

        // Verify that specific engines populated the checks correctly
        expect(result.checks.nonHttps).toBeDefined();
        expect(result.checks.nonHttps.description).toBe('Verifies if the website uses an encrypted (HTTPS) connection.');
        expect(result.checks.nonHttps.flagged).toBe(true);
        expect(result.checks.nonHttps.dataChecked).toBe('http://paypal-security-update.com');

        expect(result.checks.typosquatting).toBeDefined();
        expect(result.checks.typosquatting.flagged).toBe(true);
        expect(result.checks.typosquatting.description).toBe('Detects domains that look almost identical to popular brands.');
        expect(result.checks.typosquatting.dataChecked).toBe('paypal-security-update.com');
    });
});
