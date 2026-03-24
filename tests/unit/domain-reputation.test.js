/**
 * Unit Tests: Domain Reputation Module
 * 
 * Tests: normalizeDomain(), getReputationBadge(), cache operations.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock chrome.storage.session
const mockSessionStorage = {};
global.chrome = {
    storage: {
        session: {
            get: jest.fn(async (keyOrKeys) => {
                if (typeof keyOrKeys === 'string') {
                    return { [keyOrKeys]: mockSessionStorage[keyOrKeys] || undefined };
                }
                if (keyOrKeys === null) {
                    return { ...mockSessionStorage };
                }
                const result = {};
                for (const k of (Array.isArray(keyOrKeys) ? keyOrKeys : Object.keys(keyOrKeys))) {
                    if (mockSessionStorage[k] !== undefined) {
                        result[k] = mockSessionStorage[k];
                    }
                }
                return result;
            }),
            set: jest.fn(async (items) => {
                Object.assign(mockSessionStorage, items);
            }),
            remove: jest.fn(async (keys) => {
                const keyArr = Array.isArray(keys) ? keys : [keys];
                for (const k of keyArr) {
                    delete mockSessionStorage[k];
                }
            }),
        },
    },
};

// Mock navigator.onLine
Object.defineProperty(global, 'navigator', {
    value: { onLine: true },
    writable: true,
    configurable: true,
});

const {
    normalizeDomain,
    getReputationBadge,
    getCachedReputation,
    cacheReputation,
    checkDomainReputation,
} = await import('../../extension/src/lib/domain-reputation.js');

// ============================================================================
// normalizeDomain()
// ============================================================================
describe('normalizeDomain', () => {
    test('strips protocol and path', () => {
        expect(normalizeDomain('https://example.com/path?q=1#hash')).toBe('example.com');
    });

    test('strips www prefix', () => {
        expect(normalizeDomain('https://www.example.com')).toBe('example.com');
    });

    test('lowercases hostname', () => {
        expect(normalizeDomain('https://EXAMPLE.COM')).toBe('example.com');
    });

    test('preserves subdomains (except www)', () => {
        expect(normalizeDomain('https://login.evil.example.com')).toBe('login.evil.example.com');
    });

    test('handles IP addresses', () => {
        expect(normalizeDomain('http://192.168.1.1:8080/page')).toBe('192.168.1.1');
    });

    test('handles localhost', () => {
        expect(normalizeDomain('http://localhost:3000')).toBe('localhost');
    });

    test('returns empty string for invalid URLs', () => {
        expect(normalizeDomain('not a url')).toBe('');
        expect(normalizeDomain('')).toBe('');
    });

    test('handles URLs with auth info', () => {
        expect(normalizeDomain('https://user:pass@example.com/path')).toBe('example.com');
    });
});

// ============================================================================
// getReputationBadge() — Scoring Thresholds (Abuse Prevention)
// ============================================================================
describe('getReputationBadge', () => {
    test('returns null for clean domains (score=0)', () => {
        expect(getReputationBadge(0, 0, false)).toBeNull();
    });

    test('returns null for high score but only 1 reporter (abuse prevention)', () => {
        expect(getReputationBadge(50, 1, false)).toBeNull();
    });

    test('returns null for score=4 even with many reporters', () => {
        expect(getReputationBadge(4, 10, false)).toBeNull();
    });

    test('returns CAUTION for score >= 5 AND >= 2 reporters', () => {
        const badge = getReputationBadge(5, 2, false);
        expect(badge).not.toBeNull();
        expect(badge.level).toBe('CAUTION');
        expect(badge.color).toBe('#f59e0b');
    });

    test('returns SUSPICIOUS for score >= 15 AND >= 5 reporters', () => {
        const badge = getReputationBadge(15, 5, false);
        expect(badge).not.toBeNull();
        expect(badge.level).toBe('SUSPICIOUS');
        expect(badge.color).toBe('#f97316');
    });

    test('returns LIKELY_SCAM for score >= 50 AND >= 15 reporters', () => {
        const badge = getReputationBadge(50, 15, false);
        expect(badge).not.toBeNull();
        expect(badge.level).toBe('LIKELY_SCAM');
        expect(badge.color).toBe('#DC2626');
    });

    test('returns DANGEROUS when external API flags (regardless of reporters)', () => {
        const badge = getReputationBadge(0, 0, true);
        expect(badge).not.toBeNull();
        expect(badge.level).toBe('DANGEROUS');
        expect(badge.color).toBe('#DC2626');
    });

    test('external flag overrides score-based thresholds', () => {
        const badge = getReputationBadge(1, 1, true);
        expect(badge.level).toBe('DANGEROUS');
    });
});

// ============================================================================
// Cache Operations (chrome.storage.session)
// ============================================================================
describe('cache operations', () => {
    beforeEach(() => {
        for (const key of Object.keys(mockSessionStorage)) {
            delete mockSessionStorage[key];
        }
        jest.clearAllMocks();
    });

    test('getCachedReputation returns null for missing domain', async () => {
        const result = await getCachedReputation('example.com');
        expect(result).toBeNull();
    });

    test('cacheReputation writes to chrome.storage.session', async () => {
        const data = { score: 10, status: 'active' };
        await cacheReputation('example.com', data);

        expect(chrome.storage.session.set).toHaveBeenCalled();
        const stored = mockSessionStorage['domain_rep_example.com'];
        expect(stored).toBeDefined();
        expect(stored.data).toEqual(data);
        expect(stored.timestamp).toBeGreaterThan(0);
    });

    test('getCachedReputation returns data within TTL', async () => {
        const data = { score: 10, status: 'active' };
        await cacheReputation('example.com', data);

        const result = await getCachedReputation('example.com');
        expect(result).toEqual(data);
    });

    test('getCachedReputation returns null for expired entries', async () => {
        mockSessionStorage['domain_rep_old.com'] = {
            data: { score: 5 },
            timestamp: Date.now() - (6 * 60 * 1000)
        };

        const result = await getCachedReputation('old.com');
        expect(result).toBeNull();
        expect(chrome.storage.session.remove).toHaveBeenCalledWith('domain_rep_old.com');
    });
});

// ============================================================================
// checkDomainReputation() — Integration
// ============================================================================
describe('checkDomainReputation', () => {
    beforeEach(() => {
        for (const key of Object.keys(mockSessionStorage)) {
            delete mockSessionStorage[key];
        }
        jest.clearAllMocks();
        global.navigator.onLine = true;
    });

    test('returns null when offline', async () => {
        global.navigator.onLine = false;
        const result = await checkDomainReputation('https://example.com');
        expect(result).toBeNull();
    });

    test('returns null when liveWebProtection is disabled', async () => {
        const context = {
            getSettings: async () => ({ liveWebProtection: false }),
        };
        const result = await checkDomainReputation('https://example.com', context);
        expect(result).toBeNull();
    });

    test('returns null for whitelisted domains', async () => {
        const context = {
            getSettings: async () => ({ liveWebProtection: true }),
            isWhitelisted: async () => true,
        };
        const result = await checkDomainReputation('https://example.com', context);
        expect(result).toBeNull();
    });

    test('returns cached data if available', async () => {
        const data = { domain: 'example.com', score: 5 };
        await cacheReputation('example.com', data);

        const context = {
            getSettings: async () => ({ liveWebProtection: true }),
            isWhitelisted: async () => false,
        };
        const result = await checkDomainReputation('https://www.example.com', context);
        expect(result).toEqual(data);
    });

    test('calls Edge Function on cache miss', async () => {
        const mockResponse = { domain: 'example.com', score: 0, status: 'active' };
        const context = {
            getSettings: async () => ({ liveWebProtection: true }),
            isWhitelisted: async () => false,
            postEdgeFunction: jest.fn(async () => mockResponse),
        };

        const result = await checkDomainReputation('https://example.com', context);
        expect(result).toEqual(mockResponse);
        expect(context.postEdgeFunction).toHaveBeenCalledWith('sa-check-domain', { domain: 'example.com' });

        const cached = await getCachedReputation('example.com');
        expect(cached).toEqual(mockResponse);
    });

    test('returns null on invalid URL', async () => {
        const result = await checkDomainReputation('not-a-url');
        expect(result).toBeNull();
    });
});
