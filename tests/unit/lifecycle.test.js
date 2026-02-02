import { calculateDecayedConfidence, shouldArchive, canRenew } from '../../src/lib/lifecycle.js';

describe('Lifecycle Manager', () => {
    const DAY = 24 * 60 * 60 * 1000;

    test('calculateDecayedConfidence returns initial confidence within TTL', () => {
        const now = Date.now();
        const pattern = {
            type: 'EXACT_DOMAIN',
            initialConfidence: 100,
            createdAt: now - (2 * DAY)
        };
        // TTL for EXACT_DOMAIN is 7 days
        expect(calculateDecayedConfidence(pattern, now)).toBe(100);
    });

    test('calculateDecayedConfidence applies decay after TTL', () => {
        const now = Date.now();
        const pattern = {
            type: 'EXACT_DOMAIN',
            initialConfidence: 100,
            createdAt: now - (8 * DAY)
        };
        // 1 day over TTL (7 days). Decay rate is 20%/day.
        expect(calculateDecayedConfidence(pattern, now)).toBe(80);
    });

    test('calculateDecayedConfidence does not go below zero', () => {
        const now = Date.now();
        const pattern = {
            type: 'EXACT_DOMAIN',
            initialConfidence: 20,
            createdAt: now - (10 * DAY)
        };
        // 3 days over TTL. 3 * 20 = 60 decay. 20 - 60 = -40 -> 0.
        expect(calculateDecayedConfidence(pattern, now)).toBe(0);
    });

    test('shouldArchive identifies low confidence patterns', () => {
        expect(shouldArchive(5)).toBe(true);
        expect(shouldArchive(15)).toBe(false);
    });
});
