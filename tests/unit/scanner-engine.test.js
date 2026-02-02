import { jest, describe, it, expect } from '@jest/globals';
import { extractEmailText } from '../../src/lib/scanner/parser.js';
import { runHeuristics } from '../../src/lib/scanner/heuristics.js';

describe('Scanner Logic (Refactored)', () => {
    it('parser extracts text correctly from a mock DOM', () => {
        document.body.innerHTML = '<div class="a3s aiL">Test scam message</div>';
        const result = extractEmailText();
        expect(result).toBe('Test scam message');
    });

    it('heuristics engine identifies scam patterns', () => {
        const text = 'I need you to buy gift cards';
        const results = runHeuristics(text);
        expect(results.isScam).toBe(true);
    });
});
