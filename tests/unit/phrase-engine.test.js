/**
 * Phrase Engine Unit Tests
 * Tests all 3 exported functions in phrase-engine.js:
 *   1. checkSuspiciousKeywords
 *   2. checkUrgencySignals
 *   3. analyzePageContent
 */
import { describe, test, expect, jest, beforeAll } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const src = (rel) => resolve(__dirname, '../../src/lib/analyzer', rel);

// We need to mock local-matching and explanations before importing phrase-engine
let checkSuspiciousKeywords, checkUrgencySignals, analyzePageContent;

beforeAll(async () => {
    // Mock local-matching (used by analyzePageContent for fuzzy matching)
    jest.unstable_mockModule(src('local-matching.js'), () => ({
        findBestScamMatch: jest.fn(() => null)
    }));

    // Mock explanations (used by checkUrgencySignals and analyzePageContent)
    jest.unstable_mockModule(src('explanations.js'), () => ({
        getExplanation: jest.fn((phrase) => ({
            category: 'Test',
            reason: `Explanation for ${phrase}`
        }))
    }));

    const mod = await import('../../src/lib/analyzer/phrase-engine.js');
    checkSuspiciousKeywords = mod.checkSuspiciousKeywords;
    checkUrgencySignals = mod.checkUrgencySignals;
    analyzePageContent = mod.analyzePageContent;
});

// ─── checkSuspiciousKeywords ────────────────────────────────────────────────

describe('checkSuspiciousKeywords', () => {
    test('3+ keywords in URL → flagged', () => {
        const result = checkSuspiciousKeywords('https://login-verify-account.example.com', false);
        expect(result.flagged).toBe(true);
        expect(result.severity).toBe('MEDIUM');
        expect(result.keywords).toEqual(expect.arrayContaining(['login', 'verify', 'account']));
        expect(result.score).toBeGreaterThan(0);
    });

    test('2 keywords + suspicious TLD → flagged', () => {
        const result = checkSuspiciousKeywords('https://login-verify.example.tk', true);
        expect(result.flagged).toBe(true);
    });

    test('2 keywords + HTTPS + normal TLD → NOT flagged', () => {
        const result = checkSuspiciousKeywords('https://login-verify.example.com', false);
        expect(result.flagged).toBe(false);
        expect(result.reasonSummary).toContain('HTTPS');
    });

    test('2 keywords + HTTP (no https) → flagged', () => {
        const result = checkSuspiciousKeywords('http://login-verify.example.com', false);
        expect(result.flagged).toBe(true);
    });

    test('1 keyword only → NOT flagged with explanation', () => {
        const result = checkSuspiciousKeywords('https://login.example.com', false);
        expect(result.flagged).toBe(false);
        expect(result.keywords).toEqual(['login']);
        expect(result.reasonSummary).toContain('Single keywords');
    });

    test('0 keywords → NOT flagged', () => {
        const result = checkSuspiciousKeywords('https://www.google.com/search', false);
        expect(result.flagged).toBe(false);
        expect(result.keywords).toHaveLength(0);
        expect(result.score).toBe(0);
    });

    test('score scales with keyword count', () => {
        const result = checkSuspiciousKeywords('https://login-verify-account-billing.example.com', false);
        expect(result.score).toBe(result.keywords.length * 5);
    });

    test('keywordReasons map is populated for each found keyword', () => {
        const result = checkSuspiciousKeywords('https://login-verify-account.example.com', false);
        expect(result.keywordReasons).toHaveProperty('login');
        expect(result.keywordReasons).toHaveProperty('verify');
        expect(result.keywordReasons).toHaveProperty('account');
    });

    test('output includes all required fields', () => {
        const result = checkSuspiciousKeywords('https://example.com', false);
        expect(result).toHaveProperty('title', 'check_suspicious_keywords');
        expect(result).toHaveProperty('description');
        expect(result).toHaveProperty('flagged');
        expect(result).toHaveProperty('severity');
        expect(result).toHaveProperty('keywords');
        expect(result).toHaveProperty('keywordReasons');
        expect(result).toHaveProperty('dataChecked');
        expect(result).toHaveProperty('matches');
    });

    test('URL is lowercased for matching', () => {
        const result = checkSuspiciousKeywords('https://LOGIN-VERIFY-ACCOUNT.example.com', false);
        expect(result.flagged).toBe(true);
    });

    test('dataChecked is truncated to 5000 chars', () => {
        const longUrl = 'https://example.com/' + 'x'.repeat(6000);
        const result = checkSuspiciousKeywords(longUrl, false);
        expect(result.dataChecked.length).toBeLessThanOrEqual(5000);
    });
});

// ─── checkUrgencySignals ────────────────────────────────────────────────────

describe('checkUrgencySignals', () => {
    test('2+ urgency phrases → flagged with HIGH severity', () => {
        const result = checkUrgencySignals({
            title: 'Security Alert',
            bodyText: 'Your account has been suspended. Verify now to avoid losing access.'
        });
        expect(result.flagged).toBe(true);
        expect(result.severity).toBe('HIGH');
        expect(result.score).toBe(30);
        expect(result.matches.length).toBeGreaterThanOrEqual(2);
    });

    test('1 urgency phrase → not flagged but MEDIUM severity', () => {
        const result = checkUrgencySignals({
            title: '',
            bodyText: 'This is immediately required.'
        });
        expect(result.flagged).toBe(false);
        expect(result.severity).toBe('MEDIUM');
        expect(result.score).toBe(15);
    });

    test('gift card phrases are detected', () => {
        const result = checkUrgencySignals({
            title: '',
            bodyText: 'Buy a google play gift card and scratch the back.'
        });
        expect(result.flagged).toBe(true);
        expect(result.matches).toEqual(expect.arrayContaining(['google play', 'scratch the back']));
    });

    test('0 urgency phrases → unflagged with score 0', () => {
        const result = checkUrgencySignals({
            title: 'Meeting Notes',
            bodyText: 'The quarterly review is scheduled for next Friday.'
        });
        expect(result.flagged).toBe(false);
        expect(result.score).toBe(0);
    });

    test('null pageContent → unflagged', () => {
        const result = checkUrgencySignals(null);
        expect(result.flagged).toBe(false);
        expect(result.score).toBe(0);
    });

    test('custom phrases override default list', () => {
        const result = checkUrgencySignals(
            { title: '', bodyText: 'custom trigger phrase here and another custom one' },
            ['custom trigger phrase', 'another custom one']
        );
        expect(result.flagged).toBe(true);
        expect(result.matches).toEqual(expect.arrayContaining(['custom trigger phrase', 'another custom one']));
    });

    test('title text is also scanned', () => {
        const result = checkUrgencySignals({
            title: 'Suspicious Activity Detected',
            bodyText: 'Please verify now.'
        });
        expect(result.matches).toEqual(expect.arrayContaining(['suspicious activity', 'verify now']));
    });

    test('visualIndicators are generated for matches', () => {
        const result = checkUrgencySignals({
            title: '',
            bodyText: 'Your account has been suspended. Action required immediately.'
        });
        expect(result.visualIndicators).toBeDefined();
        expect(result.visualIndicators.length).toBeGreaterThan(0);
        expect(result.visualIndicators[0]).toHaveProperty('phrase');
    });
});

// ─── analyzePageContent ─────────────────────────────────────────────────────

describe('analyzePageContent', () => {
    test('2+ scam phrases → flagged with HIGH severity', () => {
        const result = analyzePageContent({
            title: 'You have won!',
            bodyText: 'Claim your prize now. Act now before it expires.',
        });
        expect(result.flagged).toBe(true);
        expect(result.severity).toBe('HIGH');
        expect(result.scamPhrases).toEqual(
            expect.arrayContaining(['you have won', 'claim your prize', 'act now'])
        );
        expect(result.score).toBeGreaterThanOrEqual(30);
    });

    test('1 scam phrase → flagged with MEDIUM severity', () => {
        const result = analyzePageContent({
            title: '',
            bodyText: 'Your account has been suspended until further notice.',
        });
        expect(result.flagged).toBe(true);
        expect(result.severity).toBe('MEDIUM');
        expect(result.scamPhrases).toContain('your account has been suspended');
    });

    test('clean page → NOT flagged', () => {
        const result = analyzePageContent({
            title: 'Welcome',
            bodyText: 'This is a normal website with regular content.',
        });
        expect(result.flagged).toBe(false);
        expect(result.severity).toBe('NONE');
        expect(result.score).toBe(0);
    });

    test('null pageContent → NOT flagged', () => {
        const result = analyzePageContent(null);
        expect(result.flagged).toBe(false);
    });

    test('insecure forms (password + HTTP) elevate severity to HIGH', () => {
        const result = analyzePageContent({
            title: '',
            bodyText: 'Your account has been suspended',
            forms: [{ hasPassword: true }],
            isHttps: false
        });
        expect(result.severity).toBe('HIGH');
        expect(result.hasPasswordInput).toBe(true);
        expect(result.insecureForms.length).toBeGreaterThan(0);
        expect(result.score).toBeGreaterThanOrEqual(40);
    });

    test('suspicious link mismatches add to score', () => {
        const result = analyzePageContent({
            title: '',
            bodyText: 'Click here immediately to verify.',
            linkMismatches: [{ display: 'paypal.com', actual: 'evil.com' }]
        });
        expect(result.flagged).toBe(true);
        expect(result.suspiciousLinks.length).toBe(1);
    });

    test('forms on HTTPS do NOT count as insecure', () => {
        const result = analyzePageContent({
            title: '',
            bodyText: 'Normal page content.',
            forms: [{ hasPassword: true }],
            isHttps: true
        });
        expect(result.insecureForms).toHaveLength(0);
    });

    test('linkMismatches are capped at 5', () => {
        const result = analyzePageContent({
            title: '',
            bodyText: 'Click here immediately.',
            linkMismatches: Array(10).fill({ display: 'a.com', actual: 'b.com' })
        });
        expect(result.suspiciousLinks).toHaveLength(5);
    });

    test('custom phrases override default list', () => {
        const result = analyzePageContent(
            { title: '', bodyText: 'This has a custom scam trigger.' },
            ['custom scam trigger']
        );
        expect(result.flagged).toBe(true);
        expect(result.scamPhrases).toContain('custom scam trigger');
    });

    test('gift card phrases are detected', () => {
        const result = analyzePageContent({
            title: '',
            bodyText: 'Please purchase a gift card and scratch the back to reveal the code.'
        });
        expect(result.flagged).toBe(true);
        expect(result.scamPhrases).toEqual(
            expect.arrayContaining(['purchase a gift card', 'scratch the back', 'reveal the code'])
        );
    });

    test('dataChecked is truncated to 5000 chars', () => {
        const result = analyzePageContent({
            title: '',
            bodyText: 'x'.repeat(6000)
        });
        expect(result.dataChecked.length).toBeLessThanOrEqual(5000);
    });

    test('output includes all required fields', () => {
        const result = analyzePageContent({ title: 'Test', bodyText: 'Test' });
        expect(result).toHaveProperty('title', 'analyze_page_content');
        expect(result).toHaveProperty('description');
        expect(result).toHaveProperty('flagged');
        expect(result).toHaveProperty('severity');
        expect(result).toHaveProperty('scamPhrases');
        expect(result).toHaveProperty('hasPasswordInput');
        expect(result).toHaveProperty('insecureForms');
        expect(result).toHaveProperty('suspiciousLinks');
        expect(result).toHaveProperty('matches');
        expect(result).toHaveProperty('visualIndicators');
        expect(result).toHaveProperty('score');
    });
});
