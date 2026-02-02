/**
 * Analysis Scoring Engine (v19.2 Refactored)
 */
export function calculateRiskScore(signals) {
    if (!Array.isArray(signals)) return 0;
    return signals.reduce((total, signal) => total + (signal.score || 0), 0);
}

export function determineRiskLevel(totalScore) {
    if (totalScore >= 75) return 'CRITICAL';
    if (totalScore >= 50) return 'HIGH';
    if (totalScore >= 25) return 'MEDIUM';
    if (totalScore > 0) return 'LOW';
    return 'SAFE';
}
