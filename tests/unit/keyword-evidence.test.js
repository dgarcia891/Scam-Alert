import { describe, it, expect } from '@jest/globals';
import { checkSuspiciousKeywords } from '../../extension/src/lib/analyzer/phrase-engine.js';

describe('Suspicious Keyword Evidence Expansion', () => {
    const url = 'https://example.com/safe';
    const isSuspiciousTLD = false;

    it('should detect keywords in URL only', () => {
        const urlWithKeywords = 'https://example.com/login-verify-urgent';
        const result = checkSuspiciousKeywords(urlWithKeywords, isSuspiciousTLD);

        expect(result.flagged).toBe(true);
        expect(result.keywords).toContain('login');
        expect(result.keywords).toContain('verify');
        expect(result.keywords).toContain('urgent');
        expect(result.dataChecked).toContain('URL: https://example.com/login-verify-urgent');
    });

    it('should detect keywords in page body only', () => {
        const pageContent = {
            title: 'Welcome',
            bodyText: 'Please verify your account now to avoid suspension.'
        };
        const result = checkSuspiciousKeywords(url, isSuspiciousTLD, pageContent);

        expect(result.keywords).toContain('verify');
        expect(result.keywords).toContain('account');
        expect(result.dataChecked).toContain('Page: ...verify, account...');
    });

    it('should merge keywords from both URL and page body', () => {
        const urlWithKeywords = 'https://example.com/login';
        const pageContent = {
            title: 'Security Alert',
            bodyText: 'Urgent: confirm your identity.'
        };
        const result = checkSuspiciousKeywords(urlWithKeywords, isSuspiciousTLD, pageContent);

        expect(result.keywords).toContain('login');
        expect(result.keywords).toContain('alert');
        expect(result.keywords).toContain('urgent');
        expect(result.keywords).toContain('confirm');
        expect(result.flagged).toBe(true); // 4 keywords total
    });

    it('should use custom dynamic keywords', () => {
        const customKeywords = ['winner', 'prize', 'bitcoin'];
        const pageContent = {
            bodyText: 'You are a winner! Claim your bitcoin prize.'
        };
        const result = checkSuspiciousKeywords(url, isSuspiciousTLD, pageContent, customKeywords);

        expect(result.keywords).toContain('winner');
        expect(result.keywords).toContain('prize');
        expect(result.keywords).toContain('bitcoin');
        expect(result.flagged).toBe(true);
    });
});
