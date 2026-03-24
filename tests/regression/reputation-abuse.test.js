/**
 * Regression Test: Reputation Abuse Prevention
 * 
 * Guards against Finding 5 from the critic report:
 * A single malicious reporter submitting "dangerous" reports should NOT
 * trigger a RED badge, no matter how many reports they submit.
 */
import { describe, test, expect } from '@jest/globals';
import { getReputationBadge } from '../../extension/src/lib/domain-reputation.js';

describe('Reputation Abuse Prevention (Regression)', () => {
    test('single reporter with max score does not trigger any badge', () => {
        const badge = getReputationBadge(300, 1, false);
        expect(badge).toBeNull();
    });

    test('two reporters with low score triggers yellow but not orange', () => {
        const badge = getReputationBadge(6, 2, false);
        expect(badge).not.toBeNull();
        expect(badge.level).toBe('CAUTION');
        expect(badge.level).not.toBe('SUSPICIOUS');
        expect(badge.level).not.toBe('LIKELY_SCAM');
    });

    test('high score with 4 reporters stays at CAUTION, not SUSPICIOUS', () => {
        const badge = getReputationBadge(20, 4, false);
        expect(badge.level).toBe('CAUTION');
    });

    test('14 reporters with high score stays at SUSPICIOUS, not LIKELY_SCAM', () => {
        const badge = getReputationBadge(100, 14, false);
        expect(badge.level).toBe('SUSPICIOUS');
    });

    test('legitimate escalation: 15 reporters with score 50 reaches LIKELY_SCAM', () => {
        const badge = getReputationBadge(50, 15, false);
        expect(badge.level).toBe('LIKELY_SCAM');
    });

    test('external API flag bypasses reporter threshold (authoritative source)', () => {
        const badge = getReputationBadge(0, 0, true);
        expect(badge.level).toBe('DANGEROUS');
    });
});
