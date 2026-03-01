/**
 * Tests for src/lib/analyzer/local-matching.js
 *
 * Covers:
 *   tokenize          – normalize + split + filter short words
 *   calculateSimilarity – phrase-recall metric (% of scam tokens found in page)
 *   findBestScamMatch  – best-match selection with threshold gating
 *   generateNgrams     – character n-gram generator
 */

import { jest } from '@jest/globals';

// Pure-logic module — no mocks needed
const {
  tokenize,
  calculateSimilarity,
  findBestScamMatch,
  generateNgrams
} = await import(
  new URL('../../src/lib/analyzer/local-matching.js', import.meta.url)
);

/* ════════════════════════════════════════════════════════════════════════
 *  tokenize
 * ════════════════════════════════════════════════════════════════════ */
describe('tokenize', () => {
  test('lowercases all tokens', () => {
    expect(tokenize('Hello WORLD Test')).toEqual(['hello', 'world', 'test']);
  });

  test('strips punctuation', () => {
    expect(tokenize('act now! claim $1,000')).toEqual(['act', 'now', 'claim', '1000']);
  });

  test('filters words with 2 or fewer characters', () => {
    // "a", "is", "it" are ≤2 chars → removed
    expect(tokenize('a is it hello world')).toEqual(['hello', 'world']);
  });

  test('splits on any whitespace (tabs, newlines)', () => {
    expect(tokenize("hello\tworld\nfoo   bar")).toEqual(['hello', 'world', 'foo', 'bar']);
  });

  test('returns empty array for empty string', () => {
    expect(tokenize('')).toEqual([]);
  });

  test('returns empty array when all words are short', () => {
    expect(tokenize('a b c d e f')).toEqual([]);
  });

  test('handles string with only punctuation', () => {
    expect(tokenize('!!! $$$ ...')).toEqual([]);
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  calculateSimilarity
 * ════════════════════════════════════════════════════════════════════ */
describe('calculateSimilarity', () => {
  test('returns 100 when all scam-phrase tokens appear in page text', () => {
    const page = 'You have won a special prize today';
    const scam = 'you have won a prize';
    expect(calculateSimilarity(page, scam)).toBe(100);
  });

  test('returns 0 when no scam-phrase tokens appear in page text', () => {
    const page = 'The weather is sunny today';
    const scam = 'verify your wallet now';
    expect(calculateSimilarity(page, scam)).toBe(0);
  });

  test('returns proportional score for partial overlap', () => {
    // scam tokens: ["verify", "your", "wallet"] → 3 tokens
    // page has "verify" and "wallet" → 2/3 ≈ 66.67
    const page = 'please verify the wallet address';
    const scam = 'verify your wallet';
    const score = calculateSimilarity(page, scam);
    expect(score).toBeCloseTo(66.67, 1);
  });

  test('returns 0 when scam phrase tokenizes to nothing (short words only)', () => {
    // All scam words ≤2 chars → phraseTokens.length === 0 → return 0
    expect(calculateSimilarity('hello world', 'a b c')).toBe(0);
  });

  test('is case-insensitive', () => {
    expect(calculateSimilarity('ACT NOW CLAIM', 'act now claim')).toBe(100);
  });

  test('ignores punctuation in both inputs', () => {
    expect(calculateSimilarity('act! now! claim!', 'act, now, claim')).toBe(100);
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  findBestScamMatch
 * ════════════════════════════════════════════════════════════════════ */
describe('findBestScamMatch', () => {
  const scamPhrases = [
    'you have won a prize',
    'verify your identity now',
    'your account has been suspended',
    'limited time offer act now'
  ];

  test('returns best match above default threshold (60)', () => {
    const page = 'Congratulations you have won a special prize today';
    const result = findBestScamMatch(page, scamPhrases);
    expect(result).not.toBeNull();
    expect(result.phrase).toBe('you have won a prize');
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  test('returns null when no phrase meets the threshold', () => {
    const page = 'The weather today is absolutely beautiful and warm';
    const result = findBestScamMatch(page, scamPhrases);
    expect(result).toBeNull();
  });

  test('picks the highest-scoring phrase among multiple matches', () => {
    // This text overlaps with "limited time offer act now" heavily
    const page = 'limited time offer you must act now immediately';
    const result = findBestScamMatch(page, scamPhrases);
    expect(result).not.toBeNull();
    expect(result.phrase).toBe('limited time offer act now');
  });

  test('respects custom threshold', () => {
    // "you have won" → 3 of 4 tokens match "you have won a prize" → 75%
    const page = 'you have won something';
    // With threshold 80, 75% should fail
    expect(findBestScamMatch(page, scamPhrases, 80)).toBeNull();
    // With threshold 70, 75% should pass
    const result = findBestScamMatch(page, scamPhrases, 70);
    expect(result).not.toBeNull();
  });

  test('returns null for empty page text', () => {
    expect(findBestScamMatch('', scamPhrases)).toBeNull();
  });

  test('returns null for page text that tokenizes to nothing', () => {
    expect(findBestScamMatch('a b c', scamPhrases)).toBeNull();
  });

  test('returns null when scam phrases list is empty', () => {
    expect(findBestScamMatch('you have won a prize', [])).toBeNull();
  });

  test('score is exactly 100 for perfect match', () => {
    const page = 'verify your identity now please';
    const result = findBestScamMatch(page, scamPhrases);
    expect(result).not.toBeNull();
    expect(result.score).toBe(100);
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  generateNgrams
 * ════════════════════════════════════════════════════════════════════ */
describe('generateNgrams', () => {
  test('generates trigrams by default (n=3)', () => {
    // "hello" lowercase, no spaces → "hello" → trigrams: "hel", "ell", "llo"
    expect(generateNgrams('hello')).toEqual(['hel', 'ell', 'llo']);
  });

  test('strips whitespace before generating', () => {
    // "a b" → "ab" → only 1 bigram with n=3: too short
    // "ab cd" → "abcd" → trigrams: "abc", "bcd"
    expect(generateNgrams('ab cd')).toEqual(['abc', 'bcd']);
  });

  test('lowercases input', () => {
    expect(generateNgrams('ABC')).toEqual(['abc']);
  });

  test('supports custom n-gram size', () => {
    // "abcde" → bigrams: "ab", "bc", "cd", "de"
    expect(generateNgrams('abcde', 2)).toEqual(['ab', 'bc', 'cd', 'de']);
  });

  test('returns empty array when text shorter than n', () => {
    expect(generateNgrams('ab', 3)).toEqual([]);
  });

  test('returns empty array for empty string', () => {
    expect(generateNgrams('')).toEqual([]);
  });

  test('returns single ngram when text length equals n', () => {
    expect(generateNgrams('abc', 3)).toEqual(['abc']);
  });

  test('handles strings with only whitespace', () => {
    // All whitespace removed → empty → no ngrams
    expect(generateNgrams('   ', 3)).toEqual([]);
  });
});
