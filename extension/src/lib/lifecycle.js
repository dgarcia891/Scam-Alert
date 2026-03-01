/**
 * Pattern Lifecycle Manager (Hydra Guard MVP)
 * 
 * Manages TTL (Time To Live) and confidence decay for scam patterns.
 */

const INITIAL_TTLS = {
    'EXACT_DOMAIN': 7 * 24 * 60 * 60 * 1000,     // 7 days
    'DOMAIN_PATTERN': 14 * 24 * 60 * 60 * 1000,  // 14 days
    'KEYWORD_PHRASE': 30 * 24 * 60 * 60 * 1000,  // 30 days
    'VECTOR_SIGNATURE': 60 * 24 * 60 * 60 * 1000 // 60 days
};

const DECAY_RATES = {
    'EXACT_DOMAIN': 20,     // 20% / day
    'DOMAIN_PATTERN': 10,   // 10% / day
    'KEYWORD_PHRASE': 5,    // 5% / day
    'VECTOR_SIGNATURE': 3   // 3% / day
};

/**
 * Calculate the current confidence of a pattern after decay
 * @param {Object} pattern - Pattern object { type, initialConfidence, createdAt }
 * @param {number} currentTime - Current timestamp
 * @returns {number} - Updated confidence (0-100)
 */
export function calculateDecayedConfidence(pattern, currentTime) {
    const { type, initialConfidence, createdAt } = pattern;
    const ttl = INITIAL_TTLS[type] || (30 * 24 * 60 * 60 * 1000);
    const age = currentTime - createdAt;

    if (age <= ttl) return initialConfidence;

    const decayTime = age - ttl;
    const daysOverTTL = decayTime / (24 * 60 * 60 * 1000);
    const decayRate = DECAY_RATES[type] || 5;

    const totalDecay = daysOverTTL * decayRate;
    const decayedConfidence = initialConfidence - totalDecay;

    return Math.max(0, decayedConfidence);
}

/**
 * Determine if a pattern should be archived
 * @param {number} confidence - Current confidence score
 * @returns {boolean} - True if confidence is below threshold
 */
export function shouldArchive(confidence) {
    return confidence < 10;
}

/**
 * Check if a pattern needs renewal
 * @param {Object} pattern - Pattern object
 * @param {number} lastHitTime - Last time the pattern flagged a site
 * @returns {boolean} - True if hit recently enough to renew
 */
export function canRenew(pattern, lastHitTime) {
    // Renew if hit within the last 24 hours
    const RECENT_HIT_THRESHOLD = 24 * 60 * 60 * 1000;
    return (Date.now() - lastHitTime) < RECENT_HIT_THRESHOLD;
}
