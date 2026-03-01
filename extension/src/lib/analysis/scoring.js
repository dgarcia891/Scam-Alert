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

        // Single Soft Signal: treat as LOW regardless of type.
        // A single weak signal (even a suspicious TLD alone) is NOT enough to warn.
        // 2+ signals is required for MEDIUM to prevent ghost badges on legitimate sites. (BUG-065)
        return SEVERITY.LOW;
    }

    return SEVERITY.SAFE;
}
