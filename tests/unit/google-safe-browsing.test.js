/**
 * Tests for src/lib/google-safe-browsing.js
 *
 * Covers:
 *   checkUrlsWithSafeBrowsing – batch URL check via GSB API
 *   checkUrl                  – single-URL convenience wrapper
 *   getThreatSeverity         – threat type → severity mapping
 *   parseSafeBrowsingResponse – (internal) tested indirectly via checkUrls*
 */

import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modulePath = path.resolve(__dirname, '../../src/lib/google-safe-browsing.js');

let fetchMock;

beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock;
});

afterEach(() => {
  jest.restoreAllMocks();
});

let checkUrlsWithSafeBrowsing, checkUrl, getThreatSeverity;

beforeAll(async () => {
  ({ checkUrlsWithSafeBrowsing, checkUrl, getThreatSeverity } = await import(modulePath));
});

const API_KEY = 'test-api-key-123';

/* ════════════════════════════════════════════════════════════════════════
 *  getThreatSeverity
 * ════════════════════════════════════════════════════════════════════ */
describe('getThreatSeverity', () => {
  test('MALWARE → CRITICAL', () => {
    expect(getThreatSeverity('MALWARE')).toBe('CRITICAL');
  });

  test('SOCIAL_ENGINEERING → CRITICAL', () => {
    expect(getThreatSeverity('SOCIAL_ENGINEERING')).toBe('CRITICAL');
  });

  test('UNWANTED_SOFTWARE → HIGH', () => {
    expect(getThreatSeverity('UNWANTED_SOFTWARE')).toBe('HIGH');
  });

  test('POTENTIALLY_HARMFUL_APPLICATION → MEDIUM', () => {
    expect(getThreatSeverity('POTENTIALLY_HARMFUL_APPLICATION')).toBe('MEDIUM');
  });

  test('unknown threat type → UNKNOWN', () => {
    expect(getThreatSeverity('SOME_NEW_TYPE')).toBe('UNKNOWN');
  });

  test('undefined → UNKNOWN', () => {
    expect(getThreatSeverity(undefined)).toBe('UNKNOWN');
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  checkUrlsWithSafeBrowsing
 * ════════════════════════════════════════════════════════════════════ */
describe('checkUrlsWithSafeBrowsing', () => {
  test('returns empty threats when no API key is provided', async () => {
    const result = await checkUrlsWithSafeBrowsing(['https://example.com'], null);
    expect(result).toEqual({ threats: {} });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('returns empty threats for empty string API key', async () => {
    const result = await checkUrlsWithSafeBrowsing(['https://example.com'], '');
    expect(result).toEqual({ threats: {} });
  });

  test('sends correct request body structure', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({})
    });

    await checkUrlsWithSafeBrowsing(['https://example.com', 'https://evil.com'], API_KEY);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('key=test-api-key-123');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body.client.clientId).toBe('scam-alert-extension');
    expect(body.threatInfo.threatTypes).toHaveLength(4);
    expect(body.threatInfo.threatEntries).toEqual([
      { url: 'https://example.com' },
      { url: 'https://evil.com' }
    ]);
  });

  test('marks all URLs safe when API returns no matches', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({})  // no "matches" key
    });

    const urls = ['https://google.com', 'https://github.com'];
    const result = await checkUrlsWithSafeBrowsing(urls, API_KEY);

    expect(result.safe).toBe(true);
    expect(result.threats['https://google.com']).toEqual({ safe: true, threatType: null });
    expect(result.threats['https://github.com']).toEqual({ safe: true, threatType: null });
  });

  test('marks all URLs safe when matches array is empty', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ matches: [] })
    });

    const result = await checkUrlsWithSafeBrowsing(['https://safe.com'], API_KEY);
    expect(result.safe).toBe(true);
    expect(result.threats['https://safe.com'].safe).toBe(true);
  });

  test('correctly parses threat matches', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        matches: [
          {
            threat: { url: 'https://evil.com' },
            threatType: 'MALWARE',
            platformType: 'ANY_PLATFORM',
            cacheDuration: '300s'
          }
        ]
      })
    });

    const urls = ['https://safe.com', 'https://evil.com'];
    const result = await checkUrlsWithSafeBrowsing(urls, API_KEY);

    // safe.com should be safe
    expect(result.threats['https://safe.com'].safe).toBe(true);

    // evil.com should be flagged
    const evilResult = result.threats['https://evil.com'];
    expect(evilResult.safe).toBe(false);
    expect(evilResult.threatType).toBe('MALWARE');
    expect(evilResult.severity).toBe('CRITICAL');
    expect(evilResult.platformType).toBe('ANY_PLATFORM');
    expect(evilResult.cacheDuration).toBe('300s');
  });

  test('handles multiple threats across different URLs', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        matches: [
          { threat: { url: 'https://phish.com' }, threatType: 'SOCIAL_ENGINEERING', platformType: 'ANY_PLATFORM' },
          { threat: { url: 'https://junk.com' }, threatType: 'UNWANTED_SOFTWARE', platformType: 'ANY_PLATFORM' }
        ]
      })
    });

    const result = await checkUrlsWithSafeBrowsing(
      ['https://phish.com', 'https://junk.com', 'https://clean.com'],
      API_KEY
    );

    expect(result.threats['https://phish.com'].safe).toBe(false);
    expect(result.threats['https://phish.com'].severity).toBe('CRITICAL');
    expect(result.threats['https://junk.com'].safe).toBe(false);
    expect(result.threats['https://junk.com'].severity).toBe('HIGH');
    expect(result.threats['https://clean.com'].safe).toBe(true);
  });

  test('returns error object on HTTP error', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });

    const result = await checkUrlsWithSafeBrowsing(['https://test.com'], API_KEY);
    expect(result.error).toBeDefined();
    expect(result.threats).toEqual({});
  });

  test('returns error object on network failure', async () => {
    fetchMock.mockRejectedValue(new Error('Network timeout'));

    const result = await checkUrlsWithSafeBrowsing(['https://test.com'], API_KEY);
    expect(result.error).toBe('Network timeout');
    expect(result.threats).toEqual({});
  });

  test('uses AbortController for timeout', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({})
    });

    await checkUrlsWithSafeBrowsing(['https://test.com'], API_KEY);
    const fetchOptions = fetchMock.mock.calls[0][1];
    expect(fetchOptions.signal).toBeInstanceOf(AbortSignal);
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  checkUrl (single URL convenience)
 * ════════════════════════════════════════════════════════════════════ */
describe('checkUrl', () => {
  test('returns safe result for clean URL', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({})
    });

    const result = await checkUrl('https://google.com', API_KEY);
    expect(result.safe).toBe(true);
    expect(result.threatType).toBeNull();
  });

  test('returns threat details for flagged URL', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        matches: [
          {
            threat: { url: 'https://evil.com' },
            threatType: 'SOCIAL_ENGINEERING',
            platformType: 'ANY_PLATFORM'
          }
        ]
      })
    });

    const result = await checkUrl('https://evil.com', API_KEY);
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe('SOCIAL_ENGINEERING');
  });

  test('returns safe default when API errors', async () => {
    fetchMock.mockRejectedValue(new Error('timeout'));

    const result = await checkUrl('https://test.com', API_KEY);
    // checkUrl extracts from threats[url] which will be undefined on error,
    // so it falls back to { safe: true, threatType: null }
    expect(result.safe).toBe(true);
    expect(result.threatType).toBeNull();
  });

  test('wraps single URL into array for batch API call', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({})
    });

    await checkUrl('https://single.com', API_KEY);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.threatInfo.threatEntries).toEqual([{ url: 'https://single.com' }]);
  });
});
