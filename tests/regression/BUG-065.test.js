/**
 * BUG-065: Regression test for Ghost Badge on "Safe" Pages
 *
 * Context: Sites with a single soft signal (e.g., suspicious TLD or one keyword match)
 * were being incorrectly scored as MEDIUM, causing the "!" badge to display on pages
 * the popup correctly shows as SAFE.
 *
 * Root Cause: `determineSeverity` in `scoring.js` returned MEDIUM for a single
 * non-HTTP soft signal.
 *
 * Fix: A single soft signal should return LOW (not MEDIUM), so the badge is suppressed.
 * Only 2+ soft signals escalate to MEDIUM.
 */

import { describe, it, expect } from '@jest/globals';
import { determineSeverity } from '../../extension/src/lib/analysis/scoring.js';

describe('BUG-065: Single soft signal should not trigger MEDIUM badge', () => {
    it('should return LOW for a single SUSPICIOUS_TLD soft signal', () => {
        const result = determineSeverity({
            hard: [],
            soft: [{ code: 'SUSPICIOUS_TLD', message: 'Suspicious TLD' }]
        });
        // LOW or SAFE means no badge — MEDIUM would show the badge
        expect(['LOW', 'SAFE']).toContain(result);
    });

    it('should return LOW for a single KEYWORD_MATCH soft signal', () => {
        const result = determineSeverity({
            hard: [],
            soft: [{ code: 'KEYWORD_MATCH', message: 'Suspicious keywords in URL' }]
        });
        expect(['LOW', 'SAFE']).toContain(result);
    });

    it('should return MEDIUM for 2+ soft signals', () => {
        const result = determineSeverity({
            hard: [],
            soft: [
                { code: 'SUSPICIOUS_TLD', message: 'Suspicious TLD' },
                { code: 'KEYWORD_MATCH', message: 'Keyword match' }
            ]
        });
        expect(result).toBe('MEDIUM');
    });

    it('should still return LOW for a single HTTP_ONLY signal', () => {
        const result = determineSeverity({
            hard: [],
            soft: [{ code: 'HTTP_ONLY', message: 'Unencrypted connection' }]
        });
        expect(result).toBe('LOW');
    });

    it('should still return CRITICAL for a hard REPUTATION_HIT signal', () => {
        const result = determineSeverity({
            hard: [{ code: 'REPUTATION_HIT', message: 'Known phishing site' }],
            soft: []
        });
        expect(result).toBe('CRITICAL');
    });
});
