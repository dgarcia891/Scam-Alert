/**
 * Local Matching Engine (Fuzzy/Vector-style)
 * 
 * Part of Hydra Guard (v20.3)
 * Provides non-exact phrase matching to detect variations of scam wording.
 */

/**
 * Tokenize and normalize text for similarity comparison
 */
export function tokenize(text) {
    return text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 2);
}

/**
 * Calculate similarity between a scam phrase and page text.
 * Uses a "phrase recall" metric: what percentage of the scam phrase tokens
 * are present in the page text.
 */
export function calculateSimilarity(pageText, scamPhrase) {
    const pageTokens = new Set(tokenize(pageText));
    const phraseTokens = tokenize(scamPhrase);

    if (phraseTokens.length === 0) return 0;

    const matches = phraseTokens.filter(token => pageTokens.has(token));

    return (matches.length / phraseTokens.length) * 100;
}

/**
 * Find the best match for a page content snippet against a list of known scam phrases
 */
export function findBestScamMatch(pageText, scamPhrases, threshold = 60) {
    const pageTokens = tokenize(pageText);
    if (pageTokens.length === 0) return null;

    let bestMatch = null;
    let highestScore = 0;

    for (const phrase of scamPhrases) {
        const score = calculateSimilarity(pageText, phrase);
        if (score > highestScore) {
            highestScore = score;
            bestMatch = phrase;
        }
    }

    return highestScore >= threshold ? { phrase: bestMatch, score: highestScore } : null;
}

/**
 * N-gram Generator (Concept for more advanced matching)
 */
export function generateNgrams(text, n = 3) {
    const result = [];
    const normalized = text.toLowerCase().replace(/\s+/g, '');
    for (let i = 0; i <= normalized.length - n; i++) {
        result.push(normalized.substring(i, i + n));
    }
    return result;
}
