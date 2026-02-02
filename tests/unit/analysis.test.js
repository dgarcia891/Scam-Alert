import { jest, describe, it, expect } from '@jest/globals';
import { matchRegex } from '../../src/lib/analysis/regex-engine.js';
import { calculateRiskScore } from '../../src/lib/analysis/scoring.js';

describe('Analysis Engine (Refactored)', () => {
    it('regex engine matches patterns correctly', () => {
        const pattern = 'gift card';
        expect(matchRegex(pattern, 'buy a gift card')).toBe(true);
    });

    it('scoring engine calculates risk correctly', () => {
        const detectedSignals = [{ score: 30 }, { score: 40 }];
        const totalScore = calculateRiskScore(detectedSignals);
        expect(totalScore).toBe(70);
    });
});
