import { jest, describe, it, expect } from '@jest/globals';

import { analyzeUrl } from '../../src/lib/pattern-analyzer.js';

describe('Pattern Analyzer - non-HTTPS check', () => {
    it('flags http:// URLs as non-HTTPS (LOW)', () => {
        const result = analyzeUrl('http://example.com');
        expect(result.checks.nonHttps.flagged).toBe(true);
        expect(result.checks.nonHttps.severity).toBe('LOW');
        expect(result.riskLevel).toBe('LOW');
    });

    it('does not flag https:// URLs', () => {
        const result = analyzeUrl('https://example.com');
        expect(result.checks.nonHttps.flagged).toBe(false);
        expect(result.riskLevel).toBe('SAFE');
    });

    it('is case-insensitive for protocol', () => {
        const result = analyzeUrl('HTTP://example.com');
        expect(result.checks.nonHttps.flagged).toBe(true);
    });
});
