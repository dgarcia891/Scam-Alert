/**
 * Analysis Scoring Engine (v20 Refactored for Decision Support)
 * 
 * Implements "Severity Stacking" logic:
 * - High/Critical requires HARD signals.
 * - Soft signals alone are CAPPED at Medium.
 */
import { SEVERITY, SIGNAL_TYPE } from '../scan-schema.js';

/**
 * Determine Severity based on signals
 * @param {Object} signals - { hard: [], soft: [] }
 * @returns {string} One of SEVERITY constants
 */
export function determineSeverity(signals) {
    const hasHardSignals = signals.hard && signals.hard.length > 0;
    const hasSoftSignals = signals.soft && signals.soft.length > 0;

    // RULE 1: Hard Signals -> HIGH or CRITICAL
    if (hasHardSignals) {
        // Known Phishing is implicit in HARD signals for now
        // Future: Distinguish Rep Hit (Critical) vs Typosquat (High)
        const isReputationHit = signals.hard.some(s => s.code === 'REPUTATION_HIT');
        return isReputationHit ? SEVERITY.CRITICAL : SEVERITY.HIGH;
    }

    // RULE 2: Soft Signals -> Capped at MEDIUM
    if (hasSoftSignals) {
        // Multiple soft signals or "Strong" soft signals -> MEDIUM
        // Single weak soft signal (like just HTTP) -> LOW (handled by caller usually, but logic here helps)

        const count = signals.soft.length;
        if (count > 1) return SEVERITY.MEDIUM;

        // Single Soft Signal check
        const signal = signals.soft[0];
        if (signal.code === 'HTTP_ONLY') return SEVERITY.LOW;

        return SEVERITY.MEDIUM; // Default single soft signal (e.g. suspicious TLD)
    }

    return SEVERITY.SAFE;
}

/**
 * Calculate Risk Score (Legacy Support - Deprecated)
 * Keeps backward compatibility for stats but not used for decision making.
 */
export function calculateRiskScore(legacySignals) {
    if (!Array.isArray(legacySignals)) return 0;
    return legacySignals.reduce((total, signal) => total + (signal.score || 0), 0);
}

/**
 * Determine Risk Level (Legacy Support - Deprecated)
 */
export function determineRiskLevel(totalScore) {
    if (totalScore >= 75) return 'CRITICAL';
    if (totalScore >= 50) return 'HIGH';
    if (totalScore >= 25) return 'MEDIUM';
    if (totalScore > 0) return 'LOW';
    return 'SAFE';
}

