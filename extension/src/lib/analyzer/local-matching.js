/**
 * Local Matching Engine (Fuzzy/Vector-style)
 * 
 * Part of Hydra Guard (v20.3)
 * Provides non-exact phrase matching to detect variations of scam wording.
 *
 * v1.0.142: Added stop-word filtering and proximity check to prevent
 * false positives from common words scattered across normal text.
 */

// Common English words that carry no scam-detection signal
const STOP_WORDS = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
    'her', 'was', 'one', 'our', 'out', 'has', 'his', 'how', 'its', 'may',
    'new', 'now', 'old', 'see', 'way', 'who', 'did', 'get', 'let', 'say',
    'she', 'too', 'use', 'been', 'have', 'from', 'this', 'that', 'with',
    'they', 'will', 'each', 'make', 'like', 'just', 'them', 'than', 'into',
    'some', 'your', 'what', 'when', 'here', 'then', 'more', 'very', 'does',
]);

/**
 * Tokenize and normalize text for similarity comparison.
 * Filters out stop words to focus on meaningful content words.
 */
export function tokenize(text, filterStopWords = false) {
    const tokens = text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 2);
    return filterStopWords ? tokens.filter(w => !STOP_WORDS.has(w)) : tokens;
}

/**
 * Calculate similarity between a scam phrase and page text.
 * Uses a "phrase recall" metric: what percentage of the scam phrase's
 * MEANINGFUL tokens (stop words excluded) are present in the page text.
 */
export function calculateSimilarity(pageText, scamPhrase) {
    const pageTokens = new Set(tokenize(pageText, false));
    const phraseTokens = tokenize(scamPhrase, true); // filter stop words

    if (phraseTokens.length === 0) return 0;

    const matches = phraseTokens.filter(token => pageTokens.has(token));

    return (matches.length / phraseTokens.length) * 100;
}

/**
 * Check if matched tokens appear near each other in the text (within a window).
 * Prevents matching when keywords are scattered across unrelated paragraphs.
 */
function checkProximity(pageText, scamPhrase, windowSize = 80) {
    const phraseTokens = tokenize(scamPhrase, true);
    if (phraseTokens.length < 2) return true; // single keyword, no proximity needed

    const text = pageText.toLowerCase();
    // Slide a window across the text and check if most phrase tokens appear within it
    const words = text.split(/\s+/);
    const needed = Math.ceil(phraseTokens.length * 0.6); // at least 60% in one window

    for (let i = 0; i <= words.length - Math.min(windowSize, words.length); i++) {
        const window = words.slice(i, i + windowSize).join(' ');
        let found = 0;
        for (const token of phraseTokens) {
            if (window.includes(token)) found++;
        }
        if (found >= needed) return true;
    }
    return false;
}

/**
 * Find the best match for a page content snippet against a list of known scam phrases.
 * Uses stop-word-filtered similarity + proximity verification.
 */
export function findBestScamMatch(pageText, scamPhrases, threshold = 60) {
    const pageTokens = tokenize(pageText, false);
    if (pageTokens.length === 0) return null;

    let bestMatch = null;
    let highestScore = 0;

    for (const phrase of scamPhrases) {
        const score = calculateSimilarity(pageText, phrase);
        if (score > highestScore && score >= threshold) {
            // Verify proximity — tokens must cluster together, not be scattered
            if (checkProximity(pageText, phrase)) {
                highestScore = score;
                bestMatch = phrase;
            }
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
