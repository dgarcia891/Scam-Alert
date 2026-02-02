/**
 * Analysis Regex Engine (v19.2 Refactored)
 */
export const ANALYSIS_PATTERNS = {
    URGENCY: /immediately|now|urgent|suspended|limited/i,
    FINANCIAL: /bank|account|payment|invoice|wire/i,
    AUTH: /verify|login|password|confirm/i
};

export function matchRegex(patternName, text) {
    const regex = ANALYSIS_PATTERNS[patternName] || new RegExp(patternName, 'i');
    return regex.test(text);
}
