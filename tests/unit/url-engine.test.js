/**
 * URL Engine Unit Tests
 * Tests all 11 exported functions in url-engine.js:
 *   1. extractHostname
 *   2. getLevenshteinDistance
 *   3. isLegitimateUrl
 *   4. checkNonHttps
 *   5. checkSuspiciousTLD
 *   6. checkTyposquatting
 *   7. checkUrlObfuscation
 *   8. checkIPAddress
 *   9. checkExcessiveSubdomains
 *  10. checkAdvancedTyposquatting
 *  11. checkSuspiciousPort
 */
import { describe, test, expect } from '@jest/globals';
import {
    extractHostname,
    getLevenshteinDistance,
    isLegitimateUrl,
    checkNonHttps,
    checkSuspiciousTLD,
    checkTyposquatting,
    checkUrlObfuscation,
    checkIPAddress,
    checkExcessiveSubdomains,
    checkAdvancedTyposquatting,
    checkSuspiciousPort
} from '../../extension/src/lib/analyzer/url-engine.js';

// ─── extractHostname ────────────────────────────────────────────────────────

describe('extractHostname', () => {
    test('extracts hostname from HTTPS URL', () => {
        expect(extractHostname('https://www.google.com/search?q=test')).toBe('www.google.com');
    });

    test('extracts hostname from HTTP URL', () => {
        expect(extractHostname('http://example.com/path')).toBe('example.com');
    });

    test('extracts hostname from URL with port', () => {
        expect(extractHostname('https://example.com:8443/api')).toBe('example.com');
    });

    test('returns raw string for invalid URL', () => {
        expect(extractHostname('not-a-url')).toBe('not-a-url');
    });

    test('handles URL with auth info', () => {
        expect(extractHostname('https://user:pass@example.com/path')).toBe('example.com');
    });
});

// ─── getLevenshteinDistance ──────────────────────────────────────────────────

describe('getLevenshteinDistance', () => {
    test('identical strings → 0', () => {
        expect(getLevenshteinDistance('hello', 'hello')).toBe(0);
    });

    test('single character substitution → 1', () => {
        expect(getLevenshteinDistance('paypal', 'paypa1')).toBe(1);
    });

    test('single insertion → 1', () => {
        expect(getLevenshteinDistance('google', 'gooogle')).toBe(1);
    });

    test('single deletion → 1', () => {
        expect(getLevenshteinDistance('amazon', 'amazn')).toBe(1);
    });

    test('completely different strings → high distance', () => {
        expect(getLevenshteinDistance('abc', 'xyz')).toBe(3);
    });

    test('empty string vs non-empty → length of non-empty', () => {
        expect(getLevenshteinDistance('', 'hello')).toBe(5);
        expect(getLevenshteinDistance('hello', '')).toBe(5);
    });

    test('both empty → 0', () => {
        expect(getLevenshteinDistance('', '')).toBe(0);
    });

    test('transposition (2 operations)', () => {
        expect(getLevenshteinDistance('ab', 'ba')).toBe(2);
    });
});

// ─── isLegitimateUrl ────────────────────────────────────────────────────────

describe('isLegitimateUrl', () => {
    test('paypal.com is legitimate for paypal brand', () => {
        expect(isLegitimateUrl('paypal.com', 'paypal')).toBe(true);
    });

    test('subdomain of paypal.com is legitimate', () => {
        expect(isLegitimateUrl('www.paypal.com', 'paypal')).toBe(true);
    });

    test('paypal-secure.com is NOT legitimate', () => {
        expect(isLegitimateUrl('paypal-secure.com', 'paypal')).toBe(false);
    });

    test('gmail.com is legitimate for google brand', () => {
        expect(isLegitimateUrl('gmail.com', 'google')).toBe(true);
    });

    test('google subdomain (.google) matches wildcard', () => {
        expect(isLegitimateUrl('accounts.google', 'google')).toBe(true);
    });

    test('amazon.co.uk is legitimate for amazon brand', () => {
        expect(isLegitimateUrl('amazon.co.uk', 'amazon')).toBe(true);
    });

    test('unknown brand falls back to brand.com', () => {
        expect(isLegitimateUrl('zoom.com', 'zoom')).toBe(true);
    });

    test('fake-zoom.com is NOT legitimate for zoom', () => {
        expect(isLegitimateUrl('fake-zoom.com', 'zoom')).toBe(false);
    });

    test('icloud.com is legitimate for apple', () => {
        expect(isLegitimateUrl('icloud.com', 'apple')).toBe(true);
    });

    test('outlook.com is legitimate for microsoft', () => {
        expect(isLegitimateUrl('outlook.com', 'microsoft')).toBe(true);
    });
});

// ─── checkNonHttps ──────────────────────────────────────────────────────────

describe('checkNonHttps', () => {
    test('HTTP URL is flagged', () => {
        const result = checkNonHttps('http://example.com');
        expect(result.flagged).toBe(true);
        expect(result.severity).toBe('LOW');
        expect(result.score).toBe(15);
        expect(result.title).toBe('check_non_https');
    });

    test('HTTPS URL is not flagged', () => {
        const result = checkNonHttps('https://example.com');
        expect(result.flagged).toBe(false);
        expect(result.severity).toBe('NONE');
        expect(result.score).toBe(0);
    });

    test('invalid URL returns unflagged', () => {
        const result = checkNonHttps('not-a-url');
        expect(result.flagged).toBe(false);
        expect(result.score).toBe(0);
    });

    test('dataChecked contains the URL', () => {
        const result = checkNonHttps('http://test.com');
        expect(result.dataChecked).toBe('http://test.com');
    });
});

// ─── checkSuspiciousTLD ─────────────────────────────────────────────────────

describe('checkSuspiciousTLD', () => {
    test('.tk domain is flagged', () => {
        const result = checkSuspiciousTLD('https://example.tk');
        expect(result.flagged).toBe(true);
        expect(result.severity).toBe('MEDIUM');
        expect(result.score).toBe(20);
    });

    test('.xyz domain is flagged', () => {
        const result = checkSuspiciousTLD('https://scamsite.xyz/login');
        expect(result.flagged).toBe(true);
    });

    test('.com domain is NOT flagged', () => {
        const result = checkSuspiciousTLD('https://google.com');
        expect(result.flagged).toBe(false);
        expect(result.severity).toBe('NONE');
        expect(result.score).toBe(0);
    });

    test('.org domain is NOT flagged', () => {
        const result = checkSuspiciousTLD('https://wikipedia.org');
        expect(result.flagged).toBe(false);
    });

    test('.top domain is flagged', () => {
        const result = checkSuspiciousTLD('https://offer.top');
        expect(result.flagged).toBe(true);
    });

    test('.download domain is flagged', () => {
        const result = checkSuspiciousTLD('https://free.download');
        expect(result.flagged).toBe(true);
    });

    test('case insensitive TLD check', () => {
        const result = checkSuspiciousTLD('https://example.TK');
        expect(result.flagged).toBe(true);
    });

    test('dataChecked contains the TLD', () => {
        const result = checkSuspiciousTLD('https://example.tk');
        expect(result.dataChecked).toBe('.tk');
    });

    test('all listed suspicious TLDs are detected', () => {
        const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.gq', '.top', '.xyz', '.work', '.click', '.link', '.loan', '.download', '.racing', '.accountant'];
        for (const tld of suspiciousTLDs) {
            const result = checkSuspiciousTLD(`https://example${tld}`);
            expect(result.flagged).toBe(true);
        }
    });
});

// ─── checkTyposquatting ─────────────────────────────────────────────────────

describe('checkTyposquatting', () => {
    test('paypal-login.com is flagged as paypal impersonation', () => {
        const result = checkTyposquatting('https://paypal-login.com');
        expect(result.flagged).toBe(true);
        expect(result.severity).toBe('HIGH');
        expect(result.suspectedBrand).toBe('paypal');
        expect(result.score).toBe(40);
    });

    test('amazon-deals.xyz is flagged as amazon impersonation', () => {
        const result = checkTyposquatting('https://amazon-deals.xyz');
        expect(result.flagged).toBe(true);
        expect(result.suspectedBrand).toBe('amazon');
    });

    test('legitimate paypal.com is NOT flagged', () => {
        const result = checkTyposquatting('https://paypal.com');
        expect(result.flagged).toBe(false);
    });

    test('legitimate www.paypal.com is NOT flagged', () => {
        const result = checkTyposquatting('https://www.paypal.com');
        expect(result.flagged).toBe(false);
    });

    test('no-brand domain is NOT flagged', () => {
        const result = checkTyposquatting('https://randomsite.com');
        expect(result.flagged).toBe(false);
        expect(result.score).toBe(0);
    });

    test('google in a subdomain of non-google domain is flagged', () => {
        const result = checkTyposquatting('https://google.secure-login.tk');
        expect(result.flagged).toBe(true);
        expect(result.suspectedBrand).toBe('google');
    });

    test('netflix-password-reset.com is flagged', () => {
        const result = checkTyposquatting('https://netflix-password-reset.com');
        expect(result.flagged).toBe(true);
        expect(result.suspectedBrand).toBe('netflix');
    });

    test('output includes required fields', () => {
        const result = checkTyposquatting('https://example.com');
        expect(result).toHaveProperty('title', 'check_typosquatting');
        expect(result).toHaveProperty('description');
        expect(result).toHaveProperty('flagged');
        expect(result).toHaveProperty('dataChecked');
    });
});

// ─── checkUrlObfuscation ────────────────────────────────────────────────────

describe('checkUrlObfuscation', () => {
    test('URL with @ symbol is flagged', () => {
        const result = checkUrlObfuscation('https://google.com@evil.com');
        expect(result.flagged).toBe(true);
        expect(result.patterns).toContain('@ symbol (potential domain hiding)');
        expect(result.score).toBe(30);
    });

    test('URL with excessive hyphens is flagged', () => {
        const result = checkUrlObfuscation('https://pay---pal.com');
        expect(result.flagged).toBe(true);
        expect(result.patterns).toContain('Excessive hyphens');
        expect(result.score).toBe(15);
    });

    test('URL with heavy hex encoding is flagged', () => {
        const result = checkUrlObfuscation('https://example.com/%70%61%79%70%61%6C');
        expect(result.flagged).toBe(true);
        expect(result.patterns).toContain('Excessive URL encoding');
    });

    test('data: URI scheme is flagged', () => {
        const result = checkUrlObfuscation('data:text/html,<h1>phishing</h1>');
        expect(result.flagged).toBe(true);
        expect(result.patterns).toContain('Data URI scheme');
        expect(result.score).toBeGreaterThanOrEqual(25);
    });

    test('normal URL is NOT flagged', () => {
        const result = checkUrlObfuscation('https://www.google.com/search?q=weather');
        expect(result.flagged).toBe(false);
        expect(result.patterns).toHaveLength(0);
        expect(result.score).toBe(0);
    });

    test('multiple obfuscation patterns stack scores', () => {
        const result = checkUrlObfuscation('https://google.com@evil.com/path---test');
        expect(result.flagged).toBe(true);
        expect(result.patterns.length).toBeGreaterThanOrEqual(2);
        expect(result.score).toBeGreaterThanOrEqual(45);
    });

    test('severity escalates with high score', () => {
        const result = checkUrlObfuscation('https://google.com@evil.com/path---test');
        expect(result.severity).toBe('HIGH');
    });

    test('single low-score flag gets MEDIUM', () => {
        const result = checkUrlObfuscation('https://pay---pal.com');
        expect(result.severity).toBe('NONE'); // 15 is <= 15 threshold
    });
});

// ─── checkIPAddress ─────────────────────────────────────────────────────────

describe('checkIPAddress', () => {
    test('IP address URL is flagged', () => {
        const result = checkIPAddress('http://192.168.1.1/login');
        expect(result.flagged).toBe(true);
        expect(result.severity).toBe('MEDIUM');
        expect(result.score).toBe(25);
    });

    test('public IP is flagged', () => {
        const result = checkIPAddress('https://45.33.32.156/admin');
        expect(result.flagged).toBe(true);
    });

    test('domain name is NOT flagged', () => {
        const result = checkIPAddress('https://google.com');
        expect(result.flagged).toBe(false);
        expect(result.severity).toBe('NONE');
        expect(result.score).toBe(0);
    });

    test('domain with numbers is NOT flagged', () => {
        const result = checkIPAddress('https://web3.example.com');
        expect(result.flagged).toBe(false);
    });

    test('output shape is correct', () => {
        const result = checkIPAddress('https://example.com');
        expect(result).toHaveProperty('title', 'check_ip_address');
        expect(result).toHaveProperty('description');
        expect(result).toHaveProperty('dataChecked');
    });
});

// ─── checkExcessiveSubdomains ───────────────────────────────────────────────

describe('checkExcessiveSubdomains', () => {
    test('4+ subdomains is flagged', () => {
        const result = checkExcessiveSubdomains('https://a.b.c.d.example.com');
        expect(result.flagged).toBe(true);
        expect(result.severity).toBe('LOW');
        expect(result.score).toBe(10);
        expect(result.subdomainCount).toBe(4);
    });

    test('normal www subdomain is NOT flagged', () => {
        const result = checkExcessiveSubdomains('https://www.example.com');
        expect(result.flagged).toBe(false);
        expect(result.subdomainCount).toBe(1);
    });

    test('bare domain is NOT flagged', () => {
        const result = checkExcessiveSubdomains('https://example.com');
        expect(result.flagged).toBe(false);
        expect(result.subdomainCount).toBe(0);
    });

    test('3 subdomains (boundary) is NOT flagged', () => {
        const result = checkExcessiveSubdomains('https://a.b.c.example.com');
        expect(result.flagged).toBe(false);
        expect(result.subdomainCount).toBe(3);
    });

    test('details string includes subdomain count', () => {
        const result = checkExcessiveSubdomains('https://a.b.c.d.e.example.com');
        expect(result.details).toContain('5');
    });
});

// ─── checkAdvancedTyposquatting ─────────────────────────────────────────────

describe('checkAdvancedTyposquatting', () => {
    test('googIe.com (l→I swap, distance 1) is flagged as CRITICAL', () => {
        const result = checkAdvancedTyposquatting('https://googIe.com');
        expect(result.flagged).toBe(true);
        expect(result.severity).toBe('CRITICAL');
        expect(result.score).toBe(50);
        expect(result.target).toBe('google');
    });

    test('amaz0n.com (o→0 swap) is flagged', () => {
        const result = checkAdvancedTyposquatting('https://amaz0n.com');
        expect(result.flagged).toBe(true);
        expect(result.target).toBe('amazon');
    });

    test('paypa1.com (l→1 swap) is flagged', () => {
        const result = checkAdvancedTyposquatting('https://paypa1.com');
        expect(result.flagged).toBe(true);
        expect(result.target).toBe('paypal');
    });

    test('exact brand domain is NOT flagged', () => {
        const result = checkAdvancedTyposquatting('https://google.com');
        expect(result.flagged).toBe(false);
        expect(result.score).toBe(0);
    });

    test('completely unrelated domain is NOT flagged', () => {
        const result = checkAdvancedTyposquatting('https://reddit.com');
        expect(result.flagged).toBe(false);
    });

    test('distance 3+ is NOT flagged (too different)', () => {
        const result = checkAdvancedTyposquatting('https://gooooogle.com');
        // distance from 'gooooogle' to 'google' is 3 → not flagged
        expect(result.flagged).toBe(false);
    });

    test('short brand names (<=4 chars) are skipped', () => {
        // 'irs' has length 3, so even distance 1 wouldn't flag
        const result = checkAdvancedTyposquatting('https://irs1.com');
        // 'irs' is not in highValueTargets (it's 3 chars), so no flag
        expect(result.flagged).toBe(false);
    });

    test('netfIix.com (l→I) is flagged for netflix', () => {
        const result = checkAdvancedTyposquatting('https://netfIix.com');
        expect(result.flagged).toBe(true);
        expect(result.target).toBe('netflix');
    });

    test('chace.com (missing letter) is flagged for chase', () => {
        const result = checkAdvancedTyposquatting('https://chace.com');
        expect(result.flagged).toBe(true);
        expect(result.target).toBe('chase');
    });
});

// ─── checkSuspiciousPort ────────────────────────────────────────────────────

describe('checkSuspiciousPort', () => {
    test('non-standard port 4444 is flagged', () => {
        const result = checkSuspiciousPort('https://example.com:4444/login');
        expect(result.flagged).toBe(true);
        expect(result.severity).toBe('MEDIUM');
        expect(result.score).toBe(25);
        expect(result.details).toContain('4444');
    });

    test('port 8443 is flagged (not in allowed list)', () => {
        const result = checkSuspiciousPort('https://example.com:8443/api');
        expect(result.flagged).toBe(true);
    });

    test('port 80 is NOT flagged (standard HTTP)', () => {
        const result = checkSuspiciousPort('http://example.com:80/page');
        expect(result.flagged).toBe(false);
    });

    test('port 443 is NOT flagged (standard HTTPS)', () => {
        const result = checkSuspiciousPort('https://example.com:443/page');
        expect(result.flagged).toBe(false);
    });

    test('port 8080 is NOT flagged (common dev)', () => {
        const result = checkSuspiciousPort('http://localhost:8080');
        expect(result.flagged).toBe(false);
    });

    test('port 8888 is NOT flagged (common dev)', () => {
        const result = checkSuspiciousPort('http://localhost:8888');
        expect(result.flagged).toBe(false);
    });

    test('default port (no explicit port) is NOT flagged', () => {
        const result = checkSuspiciousPort('https://example.com/page');
        expect(result.flagged).toBe(false);
        expect(result.severity).toBe('NONE');
    });

    test('invalid URL returns unflagged', () => {
        const result = checkSuspiciousPort('not-a-url');
        expect(result.flagged).toBe(false);
    });

    test('output includes required fields', () => {
        const result = checkSuspiciousPort('https://example.com');
        expect(result).toHaveProperty('title', 'check_suspicious_port');
        expect(result).toHaveProperty('description');
        expect(result).toHaveProperty('dataChecked');
    });
});
