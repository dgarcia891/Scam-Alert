import { calculateUpdatedScore, applyDecay, getTrustTier, isThresholdMet } from '../../extension/src/lib/trust-engine.js';

describe('Trust Engine', () => {
    test('calculateUpdatedScore correctly increments for true positive', () => {
        expect(calculateUpdatedScore(50, { type: 'TRUE_POSITIVE' })).toBe(65);
    });

    test('calculateUpdatedScore correctly decrements for false positive', () => {
        expect(calculateUpdatedScore(50, { type: 'FALSE_POSITIVE' })).toBe(25);
    });

    test('calculateUpdatedScore respects caps', () => {
        expect(calculateUpdatedScore(95, { type: 'TRUE_POSITIVE' })).toBe(100);
        expect(calculateUpdatedScore(10, { type: 'FALSE_POSITIVE' })).toBe(0);
    });

    test('applyDecay reduces score over time', () => {
        expect(applyDecay(80, 5)).toBe(75);
        expect(applyDecay(5, 10)).toBe(0);
    });

    test('getTrustTier categorizes scores correctly', () => {
        expect(getTrustTier(15)).toBe('UNTRUSTED');
        expect(getTrustTier(40)).toBe('STANDARD');
        expect(getTrustTier(75)).toBe('TRUSTED');
        expect(getTrustTier(95)).toBe('VERIFIED');
    });

    test('isThresholdMet validates combinations', () => {
        expect(isThresholdMet(65, 'CRITICAL', 1)).toBe(true);
        expect(isThresholdMet(50, 'CRITICAL', 1)).toBe(false);
        expect(isThresholdMet(85, 'HIGH', 2)).toBe(true);
        expect(isThresholdMet(85, 'HIGH', 1)).toBe(false);
    });
});
