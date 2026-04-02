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
    checkAdvancedTyposquatting,
    checkSuspiciousPort
} from './analyzer/url-engine.js';

import {
    checkSuspiciousKeywords,
    checkUrgencySignals,
    analyzePageContent
} from './analyzer/phrase-engine.js';

import { checkEmailScams } from './analyzer/email-heuristics.js';
import { determineSeverity } from './analysis/scoring.js';
import { getMergedScamPhrases, getMergedSuspiciousKeywords, getMergedEmailKeywords, getMergedUrgencyKeywords, getMergedHeuristicRules } from './database.js';
import { SEVERITY } from './scan-schema.js';

/**
 * Analyze URL for suspicious patterns
 */
export async function analyzeUrl(url, pageContent = null, isPro = false, customPhrases = null) {
    const isSuspiciousTLD = checkSuspiciousTLD(url).flagged;

    // Fetch dynamic keywords and phrases
    const dynamicKeywords = await getMergedSuspiciousKeywords();
    const dynamicPhrases = customPhrases || await getMergedScamPhrases();
    const dynamicEmailKeywords = await getMergedEmailKeywords();
    const dynamicUrgencyKeywords = await getMergedUrgencyKeywords();
    const dynamicRules = await getMergedHeuristicRules();

    const checks = {
        nonHttps: checkNonHttps(url),
        suspiciousTLD: { flagged: isSuspiciousTLD, ...checkSuspiciousTLD(url) },
        typosquatting: checkTyposquatting(url),
        urlObfuscation: checkUrlObfuscation(url, dynamicRules),
        ipAddress: checkIPAddress(url),
        excessiveSubdomains: checkExcessiveSubdomains(url),
        suspiciousPort: checkSuspiciousPort(url),
        // BUG-148: Skip the generic URL keyword scanner on email views.
        // email-heuristics.js (checkEmailScams) handles email-specific detection
        // with contextual bigrams, intent-link mismatch, and sender analysis.
        // Running checkSuspiciousKeywords on email body text produces false
        // positives on benign words like "verify", "secure", "account".
        suspiciousKeywords: checkSuspiciousKeywords(
            url,
            isSuspiciousTLD,
            pageContent?.isEmailView ? null : pageContent,
            dynamicKeywords
        ),
        // Re-enabled for email views: uses multi-word phrases (e.g., "action required", "account locked")
        urgencySignals: checkUrgencySignals(pageContent, dynamicUrgencyKeywords),
        emailScams: checkEmailScams(pageContent, dynamicEmailKeywords),

        // Pro Features
        advancedTyposquatting: { ...checkAdvancedTyposquatting(url), isProFeature: true }
    };

    // Re-enabled for email views: uses exact phrase matches (e.g., "verify your identity")
    if (pageContent) {
        checks.contentAnalysis = analyzePageContent(pageContent, dynamicPhrases);
    }

    // Map checks to Hard/Soft signals (Layer 4 Decision Logic)
    const hardSignals = [];
    const softSignals = [];

    const HARD_SIGNAL_CHECKS = ['typosquatting', 'advancedTyposquatting', 'ipAddress', 'urlObfuscation'];
    const SOFT_SIGNAL_CHECKS = ['nonHttps', 'suspiciousTLD', 'excessiveSubdomains', 'suspiciousPort', 'suspiciousKeywords', 'urgencySignals', 'emailScams'];

    Object.entries(checks).forEach(([key, check]) => {
        if (!check || !check.flagged) return;
        if (check.isProFeature && !isPro) return;

        // Map to signal object
        const signal = {
            code: key.toUpperCase(),
            message: check.details || check.reason || check.description || 'Suspicious activity detected',
            score: check.score || 0
        };

        // Promotion Logic: Typosquatting is a critical reputation indicator
        if (key === 'typosquatting' || key === 'advancedTyposquatting') {
            signal.code = 'REPUTATION_HIT';
        }

        if (HARD_SIGNAL_CHECKS.includes(key)) {
            hardSignals.push(signal);
        } else if (SOFT_SIGNAL_CHECKS.includes(key) || key === 'contentAnalysis') {
            softSignals.push(signal);
        }
    });

    const overallSeverity = determineSeverity({ hard: hardSignals, soft: softSignals });

    return {
        url,
        overallSeverity,
        severity: overallSeverity, // Backward compatibility
        signals: { hard: hardSignals, soft: softSignals },
        checks,
        recommendations: [getRecommendation(overallSeverity)],
        timestamp: new Date().toISOString()
    };
}

export function getRecommendation(severity) {
    if (severity === SEVERITY.CRITICAL) return 'DO NOT PROCEED - Known scam site or critical threat';
    if (severity === SEVERITY.HIGH) return 'DO NOT PROCEED - High risk of scam';
    if (severity === SEVERITY.MEDIUM) return 'Proceed with extreme caution - multiple suspicious signals';
    if (severity === SEVERITY.LOW) return 'Be cautious - verify before entering any information';
    return 'Appears safe';
}

// Re-export specific checks for legacy/direct usage
export {
    checkSuspiciousTLD,
    checkTyposquatting,
    checkUrlObfuscation
};
