/**
 * Rollback Manager (Hydra Guard MVP)
 * 
 * Monitors for potential false positives and triggers emergency rollbacks
 * for problematic patterns.
 */

/**
 * Check if a pattern should be suspended based on user feedback
 * @param {Object} metrics - { dismissalCount, warningCount, timeWindowMs }
 * @returns {boolean} - True if pattern should be suspended
 */
export function shouldSuspendPattern(metrics) {
    const { dismissalCount, warningCount, timeWindowMs } = metrics;

    // Suspend if 5+ dismissals within 1 hour
    if (dismissalCount >= 5 && timeWindowMs <= (60 * 60 * 1000)) {
        return true;
    }

    // Suspend if high dismissal rate (> 30% of warnings dismissed)
    if (warningCount >= 20 && (dismissalCount / warningCount) > 0.3) {
        return true;
    }

    return false;
}

/**
 * Determine if a domain is a "High Value Target" that should never be auto-blocked
 * @param {string} domain - Domain to check
 * @returns {boolean} - True if domain is whitelisted/high-value
 */
export function isProtectedDomain(domain) {
    const top10k = [
        'google.com', 'amazon.com', 'facebook.com', 'apple.com', 'microsoft.com',
        'netflix.com', 'paypal.com', 'chase.com', 'bankofamerica.com'
    ];

    const normalized = domain.replace(/^www\./, '').toLowerCase();
    return top10k.some(top => normalized === top || normalized.endsWith(`.${top}`));
}

/**
 * Monitor warning activity for rollback triggers
 * @param {Array} events - List of { type: 'WARNING' | 'DISMISSAL', timestamp, patternId, domain }
 * @returns {Array} - List of pattern IDs that should be rolled back
 */
export function detectAnomalies(events) {
    const patternMetrics = {};
    const rollbacks = new Set();
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;

    events.forEach(event => {
        if (now - event.timestamp > ONE_HOUR) return;

        if (isProtectedDomain(event.domain)) {
            rollbacks.add(event.patternId);
        }

        if (!patternMetrics[event.patternId]) {
            patternMetrics[event.patternId] = { dismissalCount: 0, warningCount: 0, timeWindowMs: ONE_HOUR };
        }

        if (event.type === 'WARNING') patternMetrics[event.patternId].warningCount++;
        if (event.type === 'DISMISSAL') patternMetrics[event.patternId].dismissalCount++;
    });

    Object.entries(patternMetrics).forEach(([patternId, metrics]) => {
        if (shouldSuspendPattern(metrics)) {
            rollbacks.add(patternId);
        }
    });

    return Array.from(rollbacks);
}
