/**
 * BUG-066: Regression test for Ghost Badge due to `overallSeverity` field mismatch
 *
 * Root Cause: `createScanResult` in `scan-schema.js` sets `severity` but ALL consumers
 * (service-worker, icon-manager, popup) read `overallSeverity`. When `overallSeverity`
 * is `undefined`, the expression `undefined !== 'SAFE'` evaluates to TRUE, always
 * triggering the badge pipeline regardless of the actual severity.
 *
 * Fix: `createScanResult` must expose BOTH `severity` and `overallSeverity` so all
 * existing consumers work correctly without requiring a full codebase rename.
 */

import { describe, it, expect } from '@jest/globals';
import { createScanResult, SEVERITY } from '../../src/lib/scan-schema.js';

describe('BUG-066: createScanResult must expose overallSeverity', () => {
    it('should expose overallSeverity as an alias for severity', () => {
        const result = createScanResult({ severity: SEVERITY.SAFE });
        // service-worker.js reads result.overallSeverity — it must not be undefined
        expect(result.overallSeverity).toBeDefined();
        expect(result.overallSeverity).toBe('SAFE');
    });

    it('overallSeverity and severity should always be equal', () => {
        for (const sev of Object.values(SEVERITY)) {
            const result = createScanResult({ severity: sev });
            expect(result.overallSeverity).toBe(sev);
            expect(result.severity).toBe(sev);
        }
    });

    it('should not trigger badge when overallSeverity is SAFE (the core BUG-066 guard)', () => {
        const result = createScanResult({ severity: SEVERITY.SAFE });
        // Reproduce the exact isAlert check from service-worker.js line 129
        const isAlert = result.overallThreat || (result.overallSeverity !== 'SAFE' && result.overallSeverity !== 'LOW');
        expect(isAlert).toBe(false);
    });

    it('should not trigger badge when overallSeverity is LOW', () => {
        const result = createScanResult({ severity: SEVERITY.LOW });
        const isAlert = result.overallThreat || (result.overallSeverity !== 'SAFE' && result.overallSeverity !== 'LOW');
        expect(isAlert).toBe(false);
    });

    it('should trigger badge when overallSeverity is MEDIUM', () => {
        const result = createScanResult({ severity: SEVERITY.MEDIUM });
        const isAlert = result.overallThreat || (result.overallSeverity !== 'SAFE' && result.overallSeverity !== 'LOW');
        expect(isAlert).toBe(true);
    });

    it('overallThreat should default to false', () => {
        const result = createScanResult({ severity: SEVERITY.SAFE });
        expect(result.overallThreat).toBe(false);
    });

    it('overallThreat should be true for CRITICAL severity', () => {
        const result = createScanResult({ severity: SEVERITY.CRITICAL });
        expect(result.overallThreat).toBe(true);
    });
});
