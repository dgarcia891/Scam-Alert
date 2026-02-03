/**
 * Canonical Scan Result Schema (The Constitution)
 * 
 * Defines the strict contract for all scan results.
 * UI components must rely ONLY on these fields.
 */

export const SEVERITY = {
    SAFE: 'SAFE',
    LOW: 'LOW',       // Informational / Educational (Green/Gray)
    MEDIUM: 'MEDIUM', // Caution / Be Careful (Yellow) - NO OVERLAY
    HIGH: 'HIGH',     // Danger / High Risk (Red) - OVERLAY
    CRITICAL: 'CRITICAL' // Known Malicious (Red) - OVERLAY + NOTIFICATION
};

export const ACTION = {
    ALLOW: 'ALLOW',
    WARN_POPUP: 'WARN_POPUP', // Badge + Popup warning
    WARN_OVERLAY: 'WARN_OVERLAY', // Full screen interruption
    BLOCK: 'BLOCK' // Hard block (future)
};

export const SIGNAL_TYPE = {
    HARD: 'HARD', // Reputation match, Brand Typosquat -> Triggers HIGH/CRITICAL
    SOFT: 'SOFT'  // Keyword, TLD, Obfuscation -> Capped at MEDIUM
};

/**
 * Creates a canonical Scan Result object
 * @returns {Object} Canonical ScanResult
 */
export function createScanResult({
    severity = SEVERITY.SAFE,
    confidence = 'LOW',
    action = ACTION.ALLOW,
    reasons = [],
    signals = { hard: [], soft: [] },
    meta = {}
} = {}) {
    return {
        severity,
        confidence,
        action,
        reasons, // Array of { code: string, message: string }
        signals, // { hard: string[], soft: string[] }
        meta: {
            timestamp: Date.now(),
            ...meta
        }
    };
}
