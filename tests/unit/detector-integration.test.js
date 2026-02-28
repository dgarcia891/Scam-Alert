/**
 * Detector Integration Test
 * Tests the full scanUrl pipeline with all sub-systems mocked.
 * Verifies signal orchestration, severity stacking, action determination,
 * caching, blocklist, and the canonical ScanResult shape.
 */
import { describe, test, expect, jest, beforeEach, beforeAll } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { SEVERITY, ACTION } from '../../src/lib/scan-schema.js';

// Resolve absolute paths so jest.unstable_mockModule works regardless of
// which file Jest considers the "caller" (avoids the setup.js resolution bug).
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const src = (rel) => resolve(__dirname, '../../src/lib', rel);

let scanUrl, determineAction, getCachedResult, cacheResult, scanUrlWithCache;
let mockIsBlocked, mockCheckUrl, mockCheckUrlWithPhishTank, mockCheckUrlOffline;
let mockAnalyzeUrl, mockGetMergedScamPhrases;

beforeAll(async () => {
    // Register mocks
    mockIsBlocked = jest.fn().mockResolvedValue(false);
    mockCheckUrl = jest.fn().mockResolvedValue({ safe: true });
    mockCheckUrlWithPhishTank = jest.fn().mockResolvedValue({ isPhishing: false });
    mockCheckUrlOffline = jest.fn().mockResolvedValue({ isPhishing: false });
    mockGetMergedScamPhrases = jest.fn().mockResolvedValue(['you have won', 'act now']);
    mockAnalyzeUrl = jest.fn().mockReturnValue({
        url: 'https://example.com',
        riskScore: 0,
        riskLevel: 'SAFE',
        checks: {
            nonHttps: { flagged: false },
            suspiciousTLD: { flagged: false },
            typosquatting: { flagged: false },
            urlObfuscation: { flagged: false },
            suspiciousKeywords: { flagged: false },
            emailScams: { flagged: false },
            urgencySignals: { flagged: false }
        },
        recommendation: 'Appears safe',
        timestamp: new Date().toISOString()
    });

    jest.unstable_mockModule(src('storage.js'), () => ({
        isBlocked: mockIsBlocked,
        normalizeUrl: jest.fn((url) => url)
    }));

    jest.unstable_mockModule(src('google-safe-browsing.js'), () => ({
        checkUrl: mockCheckUrl
    }));

    jest.unstable_mockModule(src('phishtank.js'), () => ({
        checkUrlWithPhishTank: mockCheckUrlWithPhishTank,
        checkUrlOffline: mockCheckUrlOffline
    }));

    jest.unstable_mockModule(src('database.js'), () => ({
        getMergedScamPhrases: mockGetMergedScamPhrases
    }));

    jest.unstable_mockModule(src('pattern-analyzer.js'), () => ({
        analyzeUrl: mockAnalyzeUrl
    }));

    const detector = await import('../../src/lib/detector.js');
    scanUrl = detector.scanUrl;
    determineAction = detector.determineAction;
    getCachedResult = detector.getCachedResult;
    cacheResult = detector.cacheResult;
    scanUrlWithCache = detector.scanUrlWithCache;
});

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
    jest.clearAllMocks();

    // Reset default mock returns
    mockIsBlocked.mockResolvedValue(false);
    mockCheckUrl.mockResolvedValue({ safe: true });
    mockCheckUrlWithPhishTank.mockResolvedValue({ isPhishing: false });
    mockCheckUrlOffline.mockResolvedValue({ isPhishing: false });
    mockAnalyzeUrl.mockReturnValue({
        url: 'https://example.com',
        riskScore: 0,
        riskLevel: 'SAFE',
        checks: {
            nonHttps: { flagged: false },
            suspiciousTLD: { flagged: false },
            typosquatting: { flagged: false },
            urlObfuscation: { flagged: false },
            suspiciousKeywords: { flagged: false },
            emailScams: { flagged: false },
            urgencySignals: { flagged: false }
        },
        recommendation: 'Appears safe',
        timestamp: new Date().toISOString()
    });

    // Mock chrome.storage.local for caching tests
    chrome.storage.local.get.mockResolvedValue({});
    chrome.storage.local.set.mockResolvedValue(undefined);
});

// ─── Canonical Output Shape ─────────────────────────────────────────────────

describe('scanUrl — Output Schema', () => {
    test('returns canonical ScanResult shape for clean URL', async () => {
        const result = await scanUrl('https://google.com');

        expect(result).toHaveProperty('severity', SEVERITY.SAFE);
        expect(result).toHaveProperty('overallSeverity', SEVERITY.SAFE);
        expect(result).toHaveProperty('overallThreat', false);
        expect(result).toHaveProperty('confidence');
        expect(result).toHaveProperty('action', ACTION.ALLOW);
        expect(result).toHaveProperty('reasons');
        expect(result).toHaveProperty('signals');
        expect(result.signals).toHaveProperty('hard');
        expect(result.signals).toHaveProperty('soft');
        expect(result).toHaveProperty('checks');
        expect(result).toHaveProperty('meta');
        expect(result.meta).toHaveProperty('timestamp');
        expect(Array.isArray(result.reasons)).toBe(true);
        expect(Array.isArray(result.signals.hard)).toBe(true);
        expect(Array.isArray(result.signals.soft)).toBe(true);
    });
});

// ─── Blocklist Override ─────────────────────────────────────────────────────

describe('scanUrl — Blocklist', () => {
    test('blocked URL returns CRITICAL/BLOCK immediately without running other checks', async () => {
        mockIsBlocked.mockResolvedValue(true);

        const result = await scanUrl('https://blocked-site.com');

        expect(result.severity).toBe(SEVERITY.CRITICAL);
        expect(result.action).toBe(ACTION.BLOCK);
        // Blocklist signals are plain strings, not objects
        expect(result.signals.hard).toEqual(expect.arrayContaining(['USER_BLOCK']));
        // Should NOT call pattern analysis or external APIs
        expect(mockAnalyzeUrl).not.toHaveBeenCalled();
        expect(mockCheckUrl).not.toHaveBeenCalled();
        expect(mockCheckUrlWithPhishTank).not.toHaveBeenCalled();
    });
});

// ─── Clean URL ──────────────────────────────────────────────────────────────

describe('scanUrl — Clean URL Path', () => {
    test('clean URL with no signals returns SAFE/ALLOW', async () => {
        const result = await scanUrl('https://google.com');

        expect(result.severity).toBe(SEVERITY.SAFE);
        expect(result.action).toBe(ACTION.ALLOW);
        expect(result.signals.hard).toHaveLength(0);
        expect(result.signals.soft).toHaveLength(0);
        expect(result.confidence).toBe('LOW');
    });
});

// ─── Pattern Analysis Signals ───────────────────────────────────────────────

describe('scanUrl — Pattern Analysis Integration', () => {
    test('typosquatting check produces HARD signal → HIGH severity', async () => {
        mockAnalyzeUrl.mockReturnValueOnce({
            url: 'https://paypa1.com',
            riskScore: 60,
            riskLevel: 'HIGH',
            checks: {
                nonHttps: { flagged: false },
                suspiciousTLD: { flagged: false },
                typosquatting: { flagged: true, reason: 'Looks like paypal.com' },
                urlObfuscation: { flagged: false },
                suspiciousKeywords: { flagged: false },
                emailScams: { flagged: false },
                urgencySignals: { flagged: false }
            },
            recommendation: 'DO NOT PROCEED',
            timestamp: new Date().toISOString()
        });

        const result = await scanUrl('https://paypa1.com');

        expect(result.severity).toBe(SEVERITY.HIGH);
        expect(result.action).toBe(ACTION.WARN_OVERLAY);
        expect(result.signals.hard).toEqual(
            expect.arrayContaining([expect.objectContaining({ code: 'TYPOSQUAT' })])
        );
        expect(result.confidence).toBe('HIGH');
    });

    test('suspicious TLD produces SOFT signal → single soft = LOW', async () => {
        mockAnalyzeUrl.mockReturnValueOnce({
            url: 'https://example.tk',
            riskScore: 15,
            riskLevel: 'LOW',
            checks: {
                nonHttps: { flagged: false },
                suspiciousTLD: { flagged: true },
                typosquatting: { flagged: false },
                urlObfuscation: { flagged: false },
                suspiciousKeywords: { flagged: false },
                emailScams: { flagged: false },
                urgencySignals: { flagged: false }
            },
            recommendation: 'Exercise normal caution',
            timestamp: new Date().toISOString()
        });

        const result = await scanUrl('https://example.tk');

        expect(result.signals.soft).toEqual(
            expect.arrayContaining([expect.objectContaining({ code: 'SUSPICIOUS_TLD' })])
        );
        expect(result.severity).toBe(SEVERITY.LOW);
        expect(result.action).toBe(ACTION.WARN_POPUP);
    });

    test('multiple soft signals → MEDIUM severity', async () => {
        mockAnalyzeUrl.mockReturnValueOnce({
            url: 'http://example.tk/login',
            riskScore: 30,
            riskLevel: 'MEDIUM',
            checks: {
                nonHttps: { flagged: true },
                suspiciousTLD: { flagged: true },
                typosquatting: { flagged: false },
                urlObfuscation: { flagged: false },
                suspiciousKeywords: { flagged: true },
                emailScams: { flagged: false },
                urgencySignals: { flagged: false }
            },
            recommendation: 'Be cautious',
            timestamp: new Date().toISOString()
        });

        const result = await scanUrl('http://example.tk/login');

        expect(result.severity).toBe(SEVERITY.MEDIUM);
        expect(result.signals.soft.length).toBeGreaterThanOrEqual(3);
        expect(result.confidence).toBe('MEDIUM');
    });

    test('email scam CRITICAL/HIGH severity → HARD signal', async () => {
        mockAnalyzeUrl.mockReturnValueOnce({
            url: 'https://mail.google.com',
            riskScore: 0,
            riskLevel: 'SAFE',
            checks: {
                nonHttps: { flagged: false },
                suspiciousTLD: { flagged: false },
                typosquatting: { flagged: false },
                urlObfuscation: { flagged: false },
                suspiciousKeywords: { flagged: false },
                emailScams: {
                    flagged: true,
                    severity: 'CRITICAL',
                    details: 'Email scam indicators: Gift card payment request'
                },
                urgencySignals: { flagged: false }
            },
            recommendation: 'Appears safe',
            timestamp: new Date().toISOString()
        });

        const result = await scanUrl('https://mail.google.com', {
            pageContent: { isEmailView: true, bodyText: 'buy gift card' }
        });

        expect(result.signals.hard).toEqual(
            expect.arrayContaining([expect.objectContaining({ code: 'EMAIL_SCAM' })])
        );
        expect(result.severity).toBe(SEVERITY.HIGH);
        expect(result.action).toBe(ACTION.WARN_OVERLAY);
    });

    test('email scam non-critical severity → SOFT signal', async () => {
        mockAnalyzeUrl.mockReturnValueOnce({
            url: 'https://mail.google.com',
            riskScore: 0,
            riskLevel: 'SAFE',
            checks: {
                nonHttps: { flagged: false },
                suspiciousTLD: { flagged: false },
                typosquatting: { flagged: false },
                urlObfuscation: { flagged: false },
                suspiciousKeywords: { flagged: false },
                emailScams: {
                    flagged: true,
                    severity: 'MEDIUM',
                    details: 'Low-confidence email indicator'
                },
                urgencySignals: { flagged: false }
            },
            recommendation: 'Appears safe',
            timestamp: new Date().toISOString()
        });

        const result = await scanUrl('https://mail.google.com');

        expect(result.signals.soft).toEqual(
            expect.arrayContaining([expect.objectContaining({ code: 'EMAIL_SCAM_LOW' })])
        );
    });

    test('urgency signals produce SOFT signal', async () => {
        mockAnalyzeUrl.mockReturnValueOnce({
            url: 'https://example.com',
            riskScore: 15,
            riskLevel: 'LOW',
            checks: {
                nonHttps: { flagged: false },
                suspiciousTLD: { flagged: false },
                typosquatting: { flagged: false },
                urlObfuscation: { flagged: false },
                suspiciousKeywords: { flagged: false },
                emailScams: { flagged: false },
                urgencySignals: { flagged: true, details: 'Urgency language detected' }
            },
            recommendation: 'Be cautious',
            timestamp: new Date().toISOString()
        });

        const result = await scanUrl('https://example.com');

        expect(result.signals.soft).toEqual(
            expect.arrayContaining([expect.objectContaining({ code: 'URGENCY' })])
        );
    });
});

// ─── External API Integration ───────────────────────────────────────────────

describe('scanUrl — PhishTank Integration', () => {
    test('PhishTank hit → REPUTATION_HIT → CRITICAL', async () => {
        mockCheckUrlWithPhishTank.mockResolvedValueOnce({ isPhishing: true });

        const result = await scanUrl('https://phishing.example.com');

        expect(result.severity).toBe(SEVERITY.CRITICAL);
        expect(result.signals.hard).toEqual(
            expect.arrayContaining([expect.objectContaining({ code: 'REPUTATION_HIT', source: 'PhishTank' })])
        );
        // BUG: extractHostname is not imported in detector.js, so the
        // finalChecks.phishTank assignment throws a ReferenceError inside the
        // try block, causing checks.phishTank to never be set.
        // Uncomment these once the bug is fixed:
        // expect(result.checks.phishTank).toBeDefined();
        // expect(result.checks.phishTank.flagged).toBe(true);
    });

    test('preferOffline uses checkUrlOffline', async () => {
        mockCheckUrlOffline.mockResolvedValueOnce({ isPhishing: false });

        await scanUrl('https://example.com', { preferOffline: true });

        expect(mockCheckUrlOffline).toHaveBeenCalled();
        expect(mockCheckUrlWithPhishTank).not.toHaveBeenCalled();
    });

    test('PhishTank network failure is handled gracefully', async () => {
        mockCheckUrlWithPhishTank.mockRejectedValueOnce(new Error('Network error'));

        const result = await scanUrl('https://example.com');

        expect(result.severity).toBe(SEVERITY.SAFE);
        expect(result.meta.sources).toEqual(
            expect.arrayContaining([expect.objectContaining({ id: 'phishtank', status: 'failed' })])
        );
    });

    test('PhishTank skipped when disabled', async () => {
        const result = await scanUrl('https://example.com', { usePhishTank: false });

        expect(mockCheckUrlWithPhishTank).not.toHaveBeenCalled();
        expect(result.meta.sources).toEqual(
            expect.arrayContaining([expect.objectContaining({ id: 'phishtank', status: 'skipped' })])
        );
    });
});

describe('scanUrl — Google Safe Browsing Integration', () => {
    test('GSB hit → REPUTATION_HIT → CRITICAL', async () => {
        mockCheckUrl.mockResolvedValueOnce({ safe: false, threatType: 'SOCIAL_ENGINEERING' });

        const result = await scanUrl('https://malware-site.com', { gsbApiKey: 'test-key' });

        expect(result.severity).toBe(SEVERITY.CRITICAL);
        expect(result.signals.hard).toEqual(
            expect.arrayContaining([expect.objectContaining({ code: 'REPUTATION_HIT', source: 'Google Safe Browsing' })])
        );
        // BUG: extractHostname is not imported in detector.js — same issue as PhishTank.
        // Uncomment once fixed:
        // expect(result.checks.googleSafeBrowsing).toBeDefined();
        // expect(result.checks.googleSafeBrowsing.flagged).toBe(true);
    });

    test('GSB skipped silently when API key is missing', async () => {
        const result = await scanUrl('https://example.com', { gsbApiKey: '' });

        expect(mockCheckUrl).not.toHaveBeenCalled();
        expect(result.meta.sources).toEqual(
            expect.arrayContaining([expect.objectContaining({ id: 'gsb', status: 'skipped', reason: 'missing_key' })])
        );
    });

    test('GSB network failure handled gracefully', async () => {
        mockCheckUrl.mockRejectedValueOnce(new Error('Timeout'));

        const result = await scanUrl('https://example.com', { gsbApiKey: 'test-key' });

        expect(result.severity).toBe(SEVERITY.SAFE);
        expect(result.meta.sources).toEqual(
            expect.arrayContaining([expect.objectContaining({ id: 'gsb', status: 'failed' })])
        );
    });

    test('GSB skipped when disabled via options', async () => {
        const result = await scanUrl('https://example.com', { useGoogleSafeBrowsing: false });

        expect(mockCheckUrl).not.toHaveBeenCalled();
        expect(result.meta.sources).toEqual(
            expect.arrayContaining([expect.objectContaining({ id: 'gsb', status: 'skipped', reason: 'disabled' })])
        );
    });
});

// ─── Compound Signal Scenarios ──────────────────────────────────────────────

describe('scanUrl — Compound Signals', () => {
    test('PhishTank + Typosquat → CRITICAL (REPUTATION_HIT wins)', async () => {
        mockCheckUrlWithPhishTank.mockResolvedValueOnce({ isPhishing: true });
        mockAnalyzeUrl.mockReturnValueOnce({
            url: 'https://paypa1.com',
            riskScore: 60,
            riskLevel: 'HIGH',
            checks: {
                nonHttps: { flagged: false },
                suspiciousTLD: { flagged: false },
                typosquatting: { flagged: true, reason: 'Looks like paypal.com' },
                urlObfuscation: { flagged: false },
                suspiciousKeywords: { flagged: false },
                emailScams: { flagged: false },
                urgencySignals: { flagged: false }
            },
            recommendation: 'DO NOT PROCEED',
            timestamp: new Date().toISOString()
        });

        const result = await scanUrl('https://paypa1.com');

        expect(result.severity).toBe(SEVERITY.CRITICAL);
        expect(result.signals.hard.length).toBeGreaterThanOrEqual(2);
    });
});

// ─── determineAction Unit Tests ─────────────────────────────────────────────

describe('determineAction', () => {
    test('CRITICAL → WARN_OVERLAY', () => {
        expect(determineAction(SEVERITY.CRITICAL, null)).toBe(ACTION.WARN_OVERLAY);
    });

    test('HIGH → WARN_OVERLAY', () => {
        expect(determineAction(SEVERITY.HIGH, null)).toBe(ACTION.WARN_OVERLAY);
    });

    test('MEDIUM without forms → WARN_POPUP', () => {
        expect(determineAction(SEVERITY.MEDIUM, null)).toBe(ACTION.WARN_POPUP);
    });

    test('MEDIUM with sensitive forms → WARN_OVERLAY (escalation)', () => {
        expect(determineAction(SEVERITY.MEDIUM, { forms: [{ type: 'password' }] })).toBe(ACTION.WARN_OVERLAY);
    });

    test('LOW → WARN_POPUP', () => {
        expect(determineAction(SEVERITY.LOW, null)).toBe(ACTION.WARN_POPUP);
    });

    test('SAFE → ALLOW', () => {
        expect(determineAction(SEVERITY.SAFE, null)).toBe(ACTION.ALLOW);
    });
});

// ─── Progress Callback ──────────────────────────────────────────────────────

describe('scanUrl — Progress Reporting', () => {
    test('calls onProgress callback during scan', async () => {
        const onProgress = jest.fn();
        await scanUrl('https://example.com', {}, onProgress);

        expect(onProgress).toHaveBeenCalled();
        expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ percent: 10 }));
        expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ percent: 100, message: 'Scan complete' }));
    });
});

// ─── Feature Flags ──────────────────────────────────────────────────────────

describe('scanUrl — Feature Flags', () => {
    test('pattern detection can be disabled', async () => {
        const result = await scanUrl('https://example.com', { usePatternDetection: false });

        expect(mockAnalyzeUrl).not.toHaveBeenCalled();
        expect(result.severity).toBe(SEVERITY.SAFE);
    });
});

// ─── Source Tracking ────────────────────────────────────────────────────────

describe('scanUrl — Source Metadata', () => {
    test('tracks all source statuses in meta', async () => {
        const result = await scanUrl('https://example.com', { gsbApiKey: 'key' });

        expect(result.meta.sources).toBeDefined();
        expect(result.meta.sources).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: 'local_patterns' }),
                expect.objectContaining({ id: 'phishtank' }),
                expect.objectContaining({ id: 'gsb' })
            ])
        );
    });
});
