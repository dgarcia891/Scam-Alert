/**
 * Tests for src/lib/phishtank.js
 *
 * Covers:
 *   checkUrlWithPhishTank      – online API check
 *   downloadPhishTankDatabase  – offline DB download + chrome.storage
 *   checkUrlOffline            – offline lookup against stored DB
 *   parsePhishTankResponse     – (internal) tested indirectly via checkUrlWithPhishTank
 */

import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Mock storage.js (normalizeUrl) before importing phishtank ──────
// phishtank.js imports { normalizeUrl } from './storage.js'
// We use absolute path resolution to avoid the Jest ESM setup.js bug
const storagePath = path.resolve(__dirname, '../../src/lib/storage.js');

jest.unstable_mockModule(storagePath, () => ({
  normalizeUrl: jest.fn((url) => {
    try {
      const u = new URL(url);
      u.hash = '';
      if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
        u.pathname = u.pathname.slice(0, -1);
      }
      u.hostname = u.hostname.toLowerCase();
      return u.toString();
    } catch {
      return url;
    }
  })
}));

const modulePath = path.resolve(__dirname, '../../src/lib/phishtank.js');
const { checkUrlWithPhishTank, downloadPhishTankDatabase, checkUrlOffline } =
  await import(modulePath);

// ── Fetch mock ─────────────────────────────────────────────────────
let fetchMock;

beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock;
  chrome.storage.local.get.mockReset();
  chrome.storage.local.set.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

/* ════════════════════════════════════════════════════════════════════════
 *  checkUrlWithPhishTank (online API)
 * ════════════════════════════════════════════════════════════════════ */
describe('checkUrlWithPhishTank', () => {
  test('sends URL-encoded form data with correct fields', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: {
          url: 'https://evil.com',
          in_database: false,
          valid: false,
          verified: false
        }
      })
    });

    await checkUrlWithPhishTank('https://evil.com', { apiKey: 'my-key' });

    const [url, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');

    const body = new URLSearchParams(options.body);
    expect(body.get('url')).toBe('https://evil.com');
    expect(body.get('format')).toBe('json');
    expect(body.get('app_key')).toBe('my-key');
  });

  test('uses empty app_key when no apiKey provided', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: { url: 'https://test.com', in_database: false, valid: false, verified: false }
      })
    });

    await checkUrlWithPhishTank('https://test.com');

    const body = new URLSearchParams(fetchMock.mock.calls[0][1].body);
    expect(body.get('app_key')).toBe('');
  });

  test('returns phishing result when URL is in database and valid', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: {
          url: 'https://phish.example.com',
          in_database: true,
          valid: true,
          verified: true,
          verified_at: '2025-01-15T00:00:00Z',
          phish_id: '12345',
          phish_detail_page: 'https://phishtank.com/phish_detail.php?phish_id=12345',
          submission_time: '2025-01-10T00:00:00Z'
        }
      })
    });

    const result = await checkUrlWithPhishTank('https://phish.example.com', { apiKey: 'key' });

    expect(result.isPhishing).toBe(true);
    expect(result.inDatabase).toBe(true);
    expect(result.verified).toBe(true);
    expect(result.severity).toBe('CRITICAL');
    expect(result.phishId).toBe('12345');
    expect(result.phishDetailUrl).toBe('https://phishtank.com/phish_detail.php?phish_id=12345');
    expect(result.unknown).toBe(false);
  });

  test('returns non-phishing when URL is in DB but not valid', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: {
          url: 'https://borderline.com',
          in_database: true,
          valid: false,
          verified: false
        }
      })
    });

    const result = await checkUrlWithPhishTank('https://borderline.com', { apiKey: 'key' });
    expect(result.isPhishing).toBe(false);
    expect(result.inDatabase).toBe(true);
    expect(result.severity).toBe('SAFE');
  });

  test('returns non-phishing when URL is not in database', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: {
          url: 'https://safe.com',
          in_database: false,
          valid: false,
          verified: false
        }
      })
    });

    const result = await checkUrlWithPhishTank('https://safe.com');
    expect(result.isPhishing).toBe(false);
    expect(result.inDatabase).toBe(false);
    expect(result.severity).toBe('SAFE');
  });

  test('returns error + unknown on HTTP error', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });

    const result = await checkUrlWithPhishTank('https://test.com');
    expect(result.error).toBeDefined();
    expect(result.isPhishing).toBe(false);
    expect(result.unknown).toBe(true);
  });

  test('returns error + unknown on network failure', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await checkUrlWithPhishTank('https://test.com');
    expect(result.error).toBe('ECONNREFUSED');
    expect(result.isPhishing).toBe(false);
    expect(result.unknown).toBe(true);
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  downloadPhishTankDatabase
 * ════════════════════════════════════════════════════════════════════ */
describe('downloadPhishTankDatabase', () => {
  test('fetches from data.phishtank.com and stores in chrome.storage', async () => {
    const mockData = [
      { url: 'https://phish1.com', phish_id: '1' },
      { url: 'https://phish2.com', phish_id: '2' }
    ];

    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData)
    });
    chrome.storage.local.set.mockResolvedValue(undefined);

    const result = await downloadPhishTankDatabase('my-api-key');

    // Check fetch URL includes API key
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('data.phishtank.com');
    expect(calledUrl).toContain('app_key=my-api-key');

    // Check storage was updated
    expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
    const stored = chrome.storage.local.set.mock.calls[0][0];
    expect(stored.phishTankDatabase).toEqual(mockData);
    expect(stored.lastUpdated).toBeGreaterThan(0);

    // Returns the data
    expect(result).toEqual(mockData);
  });

  test('fetches without API key param when none provided', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([])
    });
    chrome.storage.local.set.mockResolvedValue(undefined);

    await downloadPhishTankDatabase();
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).not.toContain('app_key');
  });

  test('returns empty array on fetch failure', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));
    const result = await downloadPhishTankDatabase();
    expect(result).toEqual([]);
  });

  test('returns empty array on non-ok response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    const result = await downloadPhishTankDatabase();
    expect(result).toEqual([]);
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  checkUrlOffline
 * ════════════════════════════════════════════════════════════════════ */
describe('checkUrlOffline', () => {
  test('returns match when URL is found in offline database', async () => {
    chrome.storage.local.get.mockResolvedValue({
      phishTankDatabase: [
        {
          url: 'https://phish.example.com/login',
          phish_id: '999',
          verified: 'yes',
          verification_time: '2025-06-01T00:00:00Z',
          phish_detail_url: 'https://phishtank.com/detail/999'
        }
      ],
      lastUpdated: Date.now()
    });

    const result = await checkUrlOffline('https://phish.example.com/login');
    expect(result.isPhishing).toBe(true);
    expect(result.verified).toBe(true);
    expect(result.phishId).toBe('999');
    expect(result.severity).toBe('CRITICAL');
    expect(result.source).toBe('offline-database');
  });

  test('returns safe when URL is not in offline database', async () => {
    chrome.storage.local.get.mockResolvedValue({
      phishTankDatabase: [
        { url: 'https://other-phish.com', phish_id: '1' }
      ],
      lastUpdated: Date.now()
    });

    const result = await checkUrlOffline('https://safe-site.com');
    expect(result.isPhishing).toBe(false);
    expect(result.severity).toBe('SAFE');
    expect(result.source).toBe('offline-database');
  });

  test('returns unknown when offline database is missing', async () => {
    chrome.storage.local.get.mockResolvedValue({});

    const result = await checkUrlOffline('https://test.com');
    expect(result.isPhishing).toBe(false);
    expect(result.severity).toBe('SAFE');
    expect(result.unknown).toBe(true);
  });

  test('returns unknown when phishTankDatabase is null', async () => {
    chrome.storage.local.get.mockResolvedValue({
      phishTankDatabase: null,
      lastUpdated: null
    });

    const result = await checkUrlOffline('https://test.com');
    expect(result.unknown).toBe(true);
  });

  test('normalizes URLs for comparison (trailing slash, case)', async () => {
    chrome.storage.local.get.mockResolvedValue({
      phishTankDatabase: [
        { url: 'https://phish.com/path/', phish_id: '42', verified: 'no' }
      ],
      lastUpdated: Date.now()
    });

    // Both URLs should normalize to the same value
    const result = await checkUrlOffline('https://phish.com/path');
    // normalizeUrl strips trailing slash, so "https://phish.com/path/" → "https://phish.com/path"
    // and "https://phish.com/path" → "https://phish.com/path" → match
    expect(result.isPhishing).toBe(true);
  });

  test('returns error result on storage exception', async () => {
    chrome.storage.local.get.mockRejectedValue(new Error('Storage corrupted'));

    const result = await checkUrlOffline('https://test.com');
    expect(result.error).toBe('Storage corrupted');
    expect(result.isPhishing).toBe(false);
    expect(result.unknown).toBe(true);
  });

  test('handles verified=no correctly', async () => {
    chrome.storage.local.get.mockResolvedValue({
      phishTankDatabase: [
        {
          url: 'https://unverified.com',
          phish_id: '50',
          verified: 'no',
          verification_time: null,
          phish_detail_url: 'https://phishtank.com/detail/50'
        }
      ],
      lastUpdated: Date.now()
    });

    const result = await checkUrlOffline('https://unverified.com');
    expect(result.isPhishing).toBe(true);
    expect(result.verified).toBe(false);  // 'no' !== 'yes'
    expect(result.severity).toBe('CRITICAL');
  });
});
