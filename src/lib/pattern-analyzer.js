/**
 * Pattern-Based Scam Detection (v19.2 Modularized)
 * 
 * Orchestrates specialized heuristic engines to detect potential scams.
 */

import {
    checkNonHttps,
    checkSuspiciousTLD,
    checkTyposquatting,
    checkUrlObfuscation,
    checkIPAddress,
    checkExcessiveSubdomains,
    checkAdvancedTyposquatting
} from './analyzer/url-engine.js';

import {
    checkSuspiciousKeywords,
    checkUrgencySignals,
    analyzePageContent
} from './analyzer/phrase-engine.js';

import { checkEmailScams } from './analyzer/email-heuristics.js';
import { matchRegex } from './analysis/regex-engine.js';
import { calculateRiskScore, determineRiskLevel } from './analysis/scoring.js';

/**
 * Analyze URL for suspicious patterns
 */
export function analyzeUrl(url, pageContent = null, isPro = false, customPhrases = null) {
    const isSuspiciousTLD = checkSuspiciousTLD(url).flagged;

    const checks = {
        nonHttps: checkNonHttps(url),
        suspiciousTLD: { flagged: isSuspiciousTLD, ...checkSuspiciousTLD(url) }, // Reuse for efficiency
        typosquatting: checkTyposquatting(url),
        urlObfuscation: checkUrlObfuscation(url),
        ipAddress: checkIPAddress(url),
        excessiveSubdomains: checkExcessiveSubdomains(url),
        suspiciousKeywords: checkSuspiciousKeywords(url, isSuspiciousTLD),

        // Pro Features
        advancedTyposquatting: { ...checkAdvancedTyposquatting(url), isProFeature: true },
        urgencySignals: { ...checkUrgencySignals(pageContent, customPhrases), isProFeature: true },
        emailScams: { ...checkEmailScams(pageContent), isProFeature: true }
    };

    if (pageContent) {
        checks.contentAnalysis = analyzePageContent(pageContent, customPhrases);
    }

    // Convert checks to signals for the new scoring engine
    const signals = Object.values(checks)
        .filter(c => c && c.flagged)
        .map(c => ({ score: c.score || 0, isProFeature: c.isProFeature }));

    const riskScore = calculateRiskScore(signals.filter(s => isPro || !s.isProFeature));

    return {
        url,
        riskScore,
        riskLevel: determineRiskLevel(riskScore),
        checks,
        recommendation: getRecommendation(riskScore),
        timestamp: new Date().toISOString()
    };
}

export function getRecommendation(score) {
    if (score >= 70) return 'DO NOT PROCEED - High risk of scam';
    if (score >= 50) return 'Proceed with extreme caution';
    if (score >= 30) return 'Be cautious - verify before entering any information';
    if (score >= 15) return 'Exercise normal caution';
    return 'Appears safe';
}

// Re-export specific checks for legacy/direct usage
export {
    checkSuspiciousTLD,
    checkTyposquatting,
    checkUrlObfuscation
};
