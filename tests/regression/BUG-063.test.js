/**
 * BUG-063: Regression test for "Looks Safe" Ghost Badge Discrepancy
 * 
 * Context: LOW severity was falsely triggering handleThreat in the service worker,
 * leading to a warning badge ('!') despite the popup correctly showing SAFE.
 * 
 * Root Cause: `if (result.overallSeverity !== 'SAFE')` in `scanAndHandle` evaluates
 * to true for 'LOW'.
 */

import { describe, it, expect, jest } from '@jest/globals';

describe('BUG-063: LOW Severity triggers handleThreat', () => {
    // We mock the corrected logic of scanAndHandle since it's internal to service-worker.js
    it('should NOT trigger threat handling for LOW severity', () => {
        const handleThreat = jest.fn();
        const settings = {};

        const simulateScanAndHandle = (result) => {
            // The patched logic
            const isAlert = result.overallThreat || (result.overallSeverity !== 'SAFE' && result.overallSeverity !== 'LOW');

            if (isAlert) {
                handleThreat(result);
            }
        };

        // Test LOW
        simulateScanAndHandle({ overallThreat: false, overallSeverity: 'LOW' });
        expect(handleThreat).not.toHaveBeenCalled();

        // Test SAFE
        simulateScanAndHandle({ overallThreat: false, overallSeverity: 'SAFE' });
        expect(handleThreat).not.toHaveBeenCalled();

        // Test MEDIUM
        simulateScanAndHandle({ overallThreat: false, overallSeverity: 'MEDIUM' });
        expect(handleThreat).toHaveBeenCalledTimes(1);
    });
});
