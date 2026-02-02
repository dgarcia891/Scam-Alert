import { jest } from '@jest/globals';
import { calculateSimilarity, findBestScamMatch } from '../../src/lib/analyzer/local-matching.js';

describe('Hydra Guard - Local Matching', () => {

    test('calculateSimilarity should detect similar phrases', () => {
        const phrase1 = 'claim your prize now';
        const phrase2 = 'claim your rewards now!';
        const score = calculateSimilarity(phrase1, phrase2);

        // Tokens of phrase 2 are [claim, your, rewards, now]
        // Tokens found in phrase 1 are [claim, your, now] (3 out of 4)
        // Score: 3/4 = 75%
        expect(score).toBeCloseTo(75);
    });

    test('findBestScamMatch should find variation of scam phrase', () => {
        const scamPhrases = ['verify your identity immediately', 'your account is suspended'];
        const pageText = 'Please verify your identity right now or your account will be limited';

        const match = findBestScamMatch(pageText, scamPhrases, 40);
        expect(match).not.toBeNull();
        expect(match.phrase).toBe('verify your identity immediately');
        expect(match.score).toBeGreaterThan(40);
    });

    test('findBestScamMatch should return null if no good match', () => {
        const scamPhrases = ['verify your identity'];
        const pageText = 'this is a perfectly normal website about kittens';
        const match = findBestScamMatch(pageText, scamPhrases, 50);
        expect(match).toBeNull();
    });
});
