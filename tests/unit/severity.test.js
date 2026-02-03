
import { determineSeverity } from '../../src/lib/analysis/scoring.js';
import { SEVERITY } from '../../src/lib/scan-schema.js';

describe('Severity Stacking Logic', () => {

    test('No signals should be SAFE', () => {
        const signals = { hard: [], soft: [] };
        expect(determineSeverity(signals)).toBe(SEVERITY.SAFE);
    });

    test('Hard signals should trigger HIGH or CRITICAL', () => {
        const hardReputation = { hard: [{ code: 'REPUTATION_HIT' }], soft: [] };
        expect(determineSeverity(hardReputation)).toBe(SEVERITY.CRITICAL);

        const hardTyposquat = { hard: [{ code: 'TYPOSQUAT' }], soft: [] };
        expect(determineSeverity(hardTyposquat)).toBe(SEVERITY.HIGH);
    });

    test('Single Soft Signal (HTTP) should be LOW', () => {
        const signals = { hard: [], soft: [{ code: 'HTTP_ONLY' }] };
        expect(determineSeverity(signals)).toBe(SEVERITY.LOW);
    });

    test('Single Soft Signal (Suspicious TLD) should be MEDIUM', () => {
        const signals = { hard: [], soft: [{ code: 'SUSPICIOUS_TLD' }] };
        expect(determineSeverity(signals)).toBe(SEVERITY.MEDIUM);
    });

    test('Multiple Soft Signals should be CAPPED at MEDIUM', () => {
        const signals = {
            hard: [],
            soft: [
                { code: 'SUSPICIOUS_TLD' },
                { code: 'KEYWORD_MATCH' },
                { code: 'OBFUSCATION' }
            ]
        };
        // This is the key "Decision Support" rule: don't panic the user for soft signals
        expect(determineSeverity(signals)).toBe(SEVERITY.MEDIUM);
    });

    test('Hard + Soft Signals should act as Hard', () => {
        const signals = {
            hard: [{ code: 'TYPOSQUAT' }],
            soft: [{ code: 'HTTP_ONLY' }]
        };
        expect(determineSeverity(signals)).toBe(SEVERITY.HIGH);
    });
});
