import { jest, describe, it, expect } from '@jest/globals';

import { analyzeUrl } from '../../extension/src/lib/pattern-analyzer.js';

describe('Pattern Analyzer - non-HTTPS check', () => {
    it('flags http:// URLs as non-HTTPS (LOW)', async () => {
        const result = await analyzeUrl('http://example.com');
        expect(result.checks.nonHttps.flagged).toBe(true);
        expect(result.checks.nonHttps.severity).toBe('LOW');
        expect(result.riskLevel).toBe('LOW');
    });

    it('does not flag https:// URLs', async () => {
        const result = await analyzeUrl('https://example.com');
        expect(result.checks.nonHttps.flagged).toBe(false);
        expect(result.riskLevel).toBe('SAFE');
    });

    it('is case-insensitive for protocol', async () => {
        const result = await analyzeUrl('HTTP://example.com');
        expect(result.checks.nonHttps.flagged).toBe(true);
    });
});

describe('Pattern Analyzer - Advanced Typosquatting (Pro)', () => {
    it('detects character substitution (goog1e.com)', async () => {
        // Run as Pro to ensure score is added
        const result = await analyzeUrl('https://goog1e.com', null, true);
        expect(result.checks.advancedTyposquatting.flagged).toBe(true);
        expect(result.checks.advancedTyposquatting.target).toBe('google');
        expect(result.riskScore).toBeGreaterThanOrEqual(50);
    });

    it('detects character addition (paypals.com)', async () => {
        const result = await analyzeUrl('https://paypals.com', null, true);
        expect(result.checks.advancedTyposquatting.flagged).toBe(true);
        expect(result.checks.advancedTyposquatting.target).toBe('paypal');
    });

    it('does not flag legitimate exact match', async () => {
        const result = await analyzeUrl('https://google.com', null, true);
        expect(result.checks.advancedTyposquatting.flagged).toBe(false);
    });
});

describe('Pattern Analyzer - Urgency Signals (Pro)', () => {
    it('flags urgent language in page content', async () => {
        const pageContent = {
            title: 'Account Suspended',
            bodyText: 'Your account has been suspended. Please verify now immediately.'
        };
        const result = await analyzeUrl('https://safe-domain.com', pageContent, true);
        expect(result.checks.urgencySignals.flagged).toBe(true);
        expect(result.checks.urgencySignals.score).toBe(30);
    });

    it('does not flag normal content', async () => {
        const pageContent = {
            title: 'Welcome to our blog',
            bodyText: 'We write about interesting things here.'
        };
        const result = await analyzeUrl('https://safe-domain.com', pageContent, true);
        expect(result.checks.urgencySignals.flagged).toBe(false);
    });
});

describe('Pattern Analyzer - Pro Gating', () => {
    it('does NOT add Pro scores to total for Free users', async () => {
        // goog1e.com flags advancedTyposquatting (score 50)
        // For a free user, the riskScore should be 0 (if other checks pass)
        const result = await analyzeUrl('https://goog1e.com', null, false);
        expect(result.checks.advancedTyposquatting.flagged).toBe(true);
        expect(result.riskScore).toBe(0);
    });

    it('adds Pro scores to total for Pro users', async () => {
        const result = await analyzeUrl('https://goog1e.com', null, true);
        expect(result.checks.advancedTyposquatting.flagged).toBe(true);
        expect(result.riskScore).toBe(50);
    });
});
describe('Pattern Analyzer - Email Scams (Pro)', () => {
    it('flags gift card scam in email content', async () => {
        const pageContent = {
            isEmailView: true,
            bodyText: 'Hey, I need you to buy some Google Play gift cards for me. Please scratch the back and send me a photo of the code.'
        };
        const result = await analyzeUrl('https://mail.google.com', pageContent, true);
        expect(result.checks.emailScams.flagged).toBe(true);
        expect(result.checks.emailScams.score).toBe(50);
        expect(result.riskLevel).toBe('CRITICAL');
    });

    it('flags sender inconsistency (CEO impersonation)', async () => {
        const pageContent = {
            isEmailView: true,
            senderName: 'CEO Office',
            senderEmail: 'urgent.alert.ceo@gmail.com'
        };
        const result = await analyzeUrl('https://mail.google.com', pageContent, true);
        expect(result.checks.emailScams.flagged).toBe(true);
        expect(result.checks.emailScams.indicators).toContain('Official name from personal email address');
        expect(result.checks.emailScams.score).toBe(40);
    });

    it('flags suspicious financial requests (wire transfer)', async () => {
        const pageContent = {
            emailContext: true,
            bodyText: 'Please find the attached invoice. We need a wire transfer to our new bank details as the previous routing number is overdue.'
        };
        const result = await analyzeUrl('https://outlook.office.com', pageContent, true);
        expect(result.checks.emailScams.flagged).toBe(true);
        expect(result.checks.emailScams.score).toBe(30);
    });

    it('does not flag normal email content', async () => {
        const pageContent = {
            isEmailView: true,
            bodyText: 'Let\'s meet for lunch at the usual place.'
        };
        const result = await analyzeUrl('https://mail.google.com', pageContent, true);
        expect(result.checks.emailScams.flagged).toBe(false);
    });
});
