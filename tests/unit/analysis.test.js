import { jest, describe, it, expect } from '@jest/globals';
import { matchRegex } from '../../extension/src/lib/analysis/regex-engine.js';
import { determineSeverity } from '../../extension/src/lib/analysis/scoring.js';
import { SEVERITY } from '../../extension/src/lib/scan-schema.js';

describe('Analysis Engine (Refactored)', () => {
    it('regex engine matches patterns correctly', () => {
        const pattern = 'gift card';
        expect(matchRegex(pattern, 'buy a gift card')).toBe(true);
    });

    it('scoring engine determines severity correctly (Severity Stacking)', () => {
        // Soft signal alone capped at Medium (if 2+) or Low (if 1)
        expect(determineSeverity({ hard: [], soft: [{ code: 'SUSPICIOUS_KEYWORD' }] })).toBe(SEVERITY.LOW);
        expect(determineSeverity({ hard: [], soft: [{ code: 'SUSPICIOUS_KEYWORD' }, { code: 'NON_HTTPS' }] })).toBe(SEVERITY.MEDIUM);

        // Hard signal alone -> High
        expect(determineSeverity({ hard: [{ code: 'IP_ADDRESS' }], soft: [] })).toBe(SEVERITY.HIGH);

        // Reputation hit -> Critical
        expect(determineSeverity({ hard: [{ code: 'REPUTATION_HIT' }], soft: [] })).toBe(SEVERITY.CRITICAL);
    });
});
