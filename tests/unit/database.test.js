/**
 * Tests for src/lib/database.js
 *
 * Covers:
 *   fetchScamPatterns   – remote JSON fetch with timeout + fallback
 *   syncPatterns        – delta sync with chrome.storage merge
 *   getMergedScamPhrases – local + remote deduplication
 */

import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modulePath = path.resolve(__dirname, '../../extension/src/lib/database.js');

// ── Global fetch mock ──────────────────────────────────────────────
let fetchMock;

beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock;
  // Reset chrome.storage mocks
  chrome.storage.local.get.mockReset();
  chrome.storage.local.set.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Fresh import each test to avoid stale module state
async function loadModule() {
  // We need to bust the module cache for ESM.
  // Since database.js has no side-effects beyond constants, a single import is fine.
  const mod = await import(modulePath);
  return mod;
}

let fetchScamPatterns, syncPatterns, getMergedScamPhrases;

beforeAll(async () => {
  ({ fetchScamPatterns, syncPatterns, getMergedScamPhrases } = await loadModule());
});

/* ════════════════════════════════════════════════════════════════════════
 *  fetchScamPatterns
 * ════════════════════════════════════════════════════════════════════ */
describe('fetchScamPatterns', () => {
  test('fetches from remote URL without lastSync param when lastSync is 0', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ phrase: 'test scam' }])
    });

    const result = await fetchScamPatterns();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).not.toContain('?since=');
    expect(result).toEqual([{ phrase: 'test scam' }]);
  });

  test('appends ?since= param when lastSync > 0', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([])
    });

    await fetchScamPatterns(12345);
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('?since=12345');
  });

  test('returns null on non-ok response (fallback behavior)', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    const result = await fetchScamPatterns();
    expect(result).toBeNull();
  });

  test('returns null on network error (fallback behavior)', async () => {
    fetchMock.mockRejectedValue(new Error('Network failure'));
    const result = await fetchScamPatterns();
    expect(result).toBeNull();
  });

  test('uses AbortController with a signal', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([])
    });

    await fetchScamPatterns();
    const fetchOptions = fetchMock.mock.calls[0][1];
    expect(fetchOptions).toHaveProperty('signal');
    expect(fetchOptions.signal).toBeInstanceOf(AbortSignal);
  });

  test('returns null when fetch is aborted (timeout)', async () => {
    fetchMock.mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    const result = await fetchScamPatterns();
    expect(result).toBeNull();
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  syncPatterns
 * ════════════════════════════════════════════════════════════════════ */
describe('syncPatterns', () => {
  test('merges new unique patterns into existing storage', async () => {
    // Existing patterns in storage
    chrome.storage.local.get.mockImplementation((keys) =>
      Promise.resolve({
        lastPatternSync: 1000,
        remoteScamPatterns: [{ phrase: 'existing scam' }]
      })
    );
    chrome.storage.local.set.mockResolvedValue(undefined);

    // Remote returns one new + one duplicate
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { phrase: 'existing scam' },  // duplicate
        { phrase: 'new scam pattern' }  // new
      ])
    });

    const result = await syncPatterns();
    expect(result).toBe(true);

    // Verify merged patterns written to storage
    const setCall = chrome.storage.local.set.mock.calls[0][0];
    expect(setCall.remoteScamPatterns).toHaveLength(2);
    expect(setCall.remoteScamPatterns.map(p => p.phrase)).toContain('existing scam');
    expect(setCall.remoteScamPatterns.map(p => p.phrase)).toContain('new scam pattern');
    expect(setCall.lastPatternSync).toBeGreaterThan(0);
  });

  test('returns true without writing when new patterns array is empty', async () => {
    chrome.storage.local.get.mockResolvedValue({
      lastPatternSync: 1000,
      remoteScamPatterns: [{ phrase: 'old' }]
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([])
    });

    const result = await syncPatterns();
    expect(result).toBe(true);
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  test('returns false when fetch fails (null response)', async () => {
    chrome.storage.local.get.mockResolvedValue({
      lastPatternSync: 0,
      remoteScamPatterns: []
    });
    fetchMock.mockRejectedValue(new Error('offline'));

    const result = await syncPatterns();
    expect(result).toBe(false);
  });

  test('handles empty existing storage gracefully', async () => {
    chrome.storage.local.get.mockResolvedValue({});
    chrome.storage.local.set.mockResolvedValue(undefined);

    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ phrase: 'brand new' }])
    });

    const result = await syncPatterns();
    expect(result).toBe(true);
    const setCall = chrome.storage.local.set.mock.calls[0][0];
    expect(setCall.remoteScamPatterns).toEqual([{ phrase: 'brand new' }]);
  });

  test('passes lastSync timestamp to fetchScamPatterns', async () => {
    chrome.storage.local.get.mockResolvedValue({
      lastPatternSync: 9999,
      remoteScamPatterns: []
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([])
    });

    await syncPatterns();
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('?since=9999');
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  getMergedScamPhrases
 * ════════════════════════════════════════════════════════════════════ */
describe('getMergedScamPhrases', () => {
  test('returns local base phrases when no remote patterns exist', async () => {
    chrome.storage.local.get.mockResolvedValue({});
    const phrases = await getMergedScamPhrases();
    // Should contain all 21 local default phrases
    expect(phrases.length).toBeGreaterThanOrEqual(21);
    expect(phrases).toContain('you have won');
    expect(phrases).toContain('verify your identity');
    expect(phrases).toContain('crypto transfer');
  });

  test('merges remote phrases with local, deduplicating', async () => {
    chrome.storage.local.get.mockResolvedValue({
      remoteScamPatterns: [
        { phrase: 'you have won' },       // duplicate of local
        { phrase: 'new remote scam' }      // unique
      ]
    });

    const phrases = await getMergedScamPhrases();
    // Should still contain local phrases
    expect(phrases).toContain('you have won');
    expect(phrases).toContain('new remote scam');

    // "you have won" should appear only once (Set deduplication)
    const wonCount = phrases.filter(p => p === 'you have won').length;
    expect(wonCount).toBe(1);
  });

  test('includes all expected local default phrases', async () => {
    chrome.storage.local.get.mockResolvedValue({});
    const phrases = await getMergedScamPhrases();

    const expectedPhrases = [
      'you have won', 'claim your prize', 'act now', 'limited time',
      'your account has been suspended', 'verify your identity',
      'urgent action required', 'confirm your information',
      'click here immediately', 'your computer is infected',
      'call this number now', 'refund pending', 'tax refund',
      'purchase a gift card', 'send me the a picture of the code',
      'do not share this code', 'verify your wallet', 'compromised account',
      'legal action', 'final notice', 'money order', 'crypto transfer'
    ];

    for (const phrase of expectedPhrases) {
      expect(phrases).toContain(phrase);
    }
  });

  test('returns unique phrases only (no duplicates)', async () => {
    chrome.storage.local.get.mockResolvedValue({
      remoteScamPatterns: [
        { phrase: 'act now' },
        { phrase: 'act now' },  // duplicate remote
        { phrase: 'legal action' }  // duplicate of local
      ]
    });

    const phrases = await getMergedScamPhrases();
    const uniqueSet = new Set(phrases);
    expect(phrases.length).toBe(uniqueSet.size);
  });
});
