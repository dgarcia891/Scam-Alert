/**
 * Reporter Trust Engine (Hydra Guard MVP)
 * 
 * Manages trust scores for users reporting scams.
 * Scores (0-100) determine the validation threshold for reported patterns.
 */

const BASELINE_SCORE = 50;
const MAX_SCORE = 100;
const MIN_SCORE = 0;

/**
 * Calculate updated trust score based on report outcome
 * @param {number} currentScore - Current trust score
 * @param {Object} outcome - Result of the report validation
 * @returns {number} - New trust score
 */
export function calculateUpdatedScore(currentScore, outcome) {
    let newScore = currentScore;

    if (outcome.type === 'TRUE_POSITIVE') {
        newScore += 15;
    } else if (outcome.type === 'FALSE_POSITIVE') {
        newScore -= 25;
    }

    return Math.min(MAX_SCORE, Math.max(MIN_SCORE, newScore));
}

/**
 * Apply monthly decay to a trust score
 * @param {number} currentScore - Current trust score
 * @param {number} monthsElapsed - Months since last activity
 * @returns {number} - Decayed score
 */
export function applyDecay(currentScore, monthsElapsed) {
    const decayed = currentScore - (monthsElapsed * 1);
    return Math.max(MIN_SCORE, decayed);
}

/**
 * Determine the trust tier for a score
 * @param {number} score - Trust score
 * @returns {string} - 'UNTRUSTED' | 'STANDARD' | 'TRUSTED' | 'VERIFIED'
 */
export function getTrustTier(score) {
    if (score < 20) return 'UNTRUSTED';
    if (score < 60) return 'STANDARD';
    if (score < 90) return 'TRUSTED';
    return 'VERIFIED';
}

/**
 * Check if a report from this trust score meets the validation threshold
 * @param {number} aggregateTrust - Total trust of all reporters for a pattern
 * @param {string} severity - 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
 * @param {number} reporterCount - Number of unique reporters
 * @returns {boolean} - True if threshold is met
 */
export function isThresholdMet(aggregateTrust, severity, reporterCount) {
    const thresholds = {
        'CRITICAL': { count: 1, trust: 60 },
        'HIGH': { count: 2, trust: 80 },
        'MEDIUM': { count: 3, trust: 100 },
        'LOW': { count: 5, trust: 150 }
    };

    const config = thresholds[severity] || thresholds['LOW'];
    return reporterCount >= config.count && aggregateTrust >= config.trust;
}
