/**
 * Scam Detection Orchestrator (v20 Canonical)
 * 
 * This module combines multiple detection services into a single interface:
 * - Google Safe Browsing API
 * - PhishTank (online and offline)
 * - Pattern-based detection
 * 
 * It uses the Canonical Scan Result Schema and Severity Stacking Logic.
 */

import { checkUrl } from './google-safe-browsing.js';
import { checkUrlWithPhishTank, checkUrlOffline } from './phishtank.js';
import { analyzeUrl } from './pattern-analyzer.js';
import { getMergedScamPhrases } from './database.js';
import { createScanResult, SEVERITY, ACTION } from './scan-schema.js';
import { determineSeverity } from './analysis/scoring.js';
import { normalizeUrl, isBlocked } from './storage.js';

/**
 * Main scan function that combines all detection methods
 * @param {string} url - URL to scan
 * @param {Object} options - Scan options
 * @param {Function} onProgress - Optional callback for progress updates
 * @returns {Promise<Object>} - Canonical ScanResult
 */
export async function scanUrl(url, options = {}, onProgress = null) {
    const {
        useGoogleSafeBrowsing = true,
        usePhishTank = true,
        usePatternDetection = true,
        pageContent = null,
        preferOffline = false,
        gsbApiKey = '',
        phishTankApiKey = '',
    } = options;

    const reportProgress = (percent, message) => {
        if (onProgress) onProgress({ percent, message });
    };

    console.log(`[Scam Detector] Scanning: ${url}`);
    reportProgress(10, 'Initializing scan...');

    // 1. Check Blocklist (User Override)
    if (await isBlocked(url)) {
        return createScanResult({
            severity: SEVERITY.CRITICAL,
            confidence: 'CERTAIN',
            action: ACTION.BLOCK,
            reasons: [{ code: 'USER_BLOCK', message: 'Site is in your personal blocklist' }],
            signals: { hard: ['USER_BLOCK'], soft: [] }
        });
    }

    const hardSignals = [];
    const softSignals = [];
    const reasons = [];
    const sources = [];

    // Track local checks by default
    sources.push({ id: 'local_patterns', status: 'success' });

    let finalChecks = {};

    // 2. Local Pattern Analysis
    if (usePatternDetection) {
        reportProgress(20, 'Analyzing URL patterns...');
        const customPhrases = await getMergedScamPhrases();
        const patterns = analyzeUrl(url, pageContent, options.isPro, customPhrases);

        // Preserve all checks for the UI Activity Log
        finalChecks = { ...patterns.checks };

        // Map Pattern Checks to Signals
        if (patterns.checks.typosquatting?.flagged) {
            hardSignals.push({ code: 'TYPOSQUAT', message: patterns.checks.typosquatting.reason });
            reasons.push(patterns.checks.typosquatting);
        }

        if (patterns.checks.suspiciousTLD?.flagged) {
            softSignals.push({ code: 'SUSPICIOUS_TLD', message: 'Suspicious Top-Level Domain' });
            reasons.push(patterns.checks.suspiciousTLD);
        }

        if (patterns.checks.nonHttps?.flagged) {
            softSignals.push({ code: 'HTTP_ONLY', message: 'Unencrypted Connection' });
            reasons.push(patterns.checks.nonHttps);
        }

        if (patterns.checks.suspiciousKeywords?.flagged) {
            softSignals.push({ code: 'KEYWORD_MATCH', message: 'Suspicious keywords in URL' });
            reasons.push(patterns.checks.suspiciousKeywords);
        }

        if (patterns.checks.urlObfuscation?.flagged) {
            softSignals.push({ code: 'OBFUSCATION', message: 'URL Character Obfuscation' });
            reasons.push(patterns.checks.urlObfuscation);
        }

        // Email & Urgency Signals (BUG-070 Connectivity Fix)
        if (patterns.checks.emailScams?.flagged) {
            const emailScam = patterns.checks.emailScams;
            const isCritical = emailScam.severity === 'CRITICAL' || emailScam.severity === 'HIGH';

            if (isCritical) {
                hardSignals.push({ code: 'EMAIL_SCAM', message: emailScam.details });
            } else {
                softSignals.push({ code: 'EMAIL_SCAM_LOW', message: emailScam.details });
            }
            reasons.push(emailScam);
        }

        if (patterns.checks.urgencySignals?.flagged) {
            softSignals.push({ code: 'URGENCY', message: patterns.checks.urgencySignals.details });
            reasons.push(patterns.checks.urgencySignals);
        }
    }

    // 3. Check PhishTank (Offline/Online)
    if (usePhishTank) {
        reportProgress(40, 'Checking threat database...');
        try {
            let ptResult;
            if (preferOffline) {
                ptResult = await checkUrlOffline(url);
            } else {
                ptResult = await checkUrlWithPhishTank(url, { apiKey: phishTankApiKey });
            }

            if (ptResult.isPhishing) {
                hardSignals.push({ code: 'REPUTATION_HIT', source: 'PhishTank', message: 'Known phishing site (PhishTank)' });
                reasons.push({ code: 'PHISHTANK', message: 'Flagged by PhishTank' });
            }

            finalChecks.phishTank = {
                title: 'phish_tank_database',
                description: 'Verifies the domain against the global PhishTank threat database.',
                flagged: ptResult.isPhishing,
                severity: ptResult.isPhishing ? 'CRITICAL' : 'NONE',
                details: ptResult.isPhishing ? 'Listed in PhishTank database' : 'Not found in PhishTank',
                dataChecked: extractHostname(url)
            };

            sources.push({ id: 'phishtank', status: 'success' });
        } catch (error) {
            console.warn('PhishTank check failed', error);
            sources.push({ id: 'phishtank', status: 'failed', reason: error.message });
        }
    } else {
        sources.push({ id: 'phishtank', status: 'skipped', reason: 'disabled' });
    }

    // 4. Check Google Safe Browsing
    if (useGoogleSafeBrowsing) {
        if (gsbApiKey) {
            reportProgress(60, 'Consulting Google Safe Browsing...');
            try {
                const gsbResult = await checkUrl(url, gsbApiKey);
                if (!gsbResult.safe) {
                    hardSignals.push({ code: 'REPUTATION_HIT', source: 'Google Safe Browsing', message: `Flagged as ${gsbResult.threatType}` });
                    reasons.push({ code: 'GSB', message: `Flagged by Google Safe Browsing` });
                }

                finalChecks.googleSafeBrowsing = {
                    title: 'google_safe_browsing',
                    description: 'Consults Google\'s Safe Browsing API for known malware and phishing associations.',
                    flagged: !gsbResult.safe,
                    severity: !gsbResult.safe ? 'CRITICAL' : 'NONE',
                    details: !gsbResult.safe ? `Flagged as ${gsbResult.threatType}` : 'Safe according to Google',
                    dataChecked: extractHostname(url)
                };

                sources.push({ id: 'gsb', status: 'success' });
            } catch (error) {
                console.warn('GSB check failed', error);
                sources.push({ id: 'gsb', status: 'failed', reason: 'network_error' });
            }
        } else {
            sources.push({ id: 'gsb', status: 'skipped', reason: 'missing_key' });
        }
    } else {
        sources.push({ id: 'gsb', status: 'skipped', reason: 'disabled' });
    }

    // 5. Determine Severity & Action
    const severity = determineSeverity({ hard: hardSignals, soft: softSignals });
    const action = determineAction(severity, pageContent);

    reportProgress(100, 'Scan complete');

    return createScanResult({
        severity,
        confidence: hardSignals.length > 0 ? 'HIGH' : (softSignals.length > 0 ? 'MEDIUM' : 'LOW'),
        action,
        reasons,
        signals: { hard: hardSignals, soft: softSignals },
        checks: finalChecks,
        meta: { sources }
    });
}

/**
 * Determine the action to take based on severity and page context (Layer 4)
 * @param {string} severity - The determined severity
 * @param {Object} pageContent - Collected page signals
 * @returns {string} - The ACTION to take
 */
export function determineAction(severity, pageContent) {
    // Note: Better to just use the imported constants since we are in the same module

    if (severity === SEVERITY.CRITICAL || severity === SEVERITY.HIGH) {
        return ACTION.WARN_OVERLAY;
    }

    if (severity === SEVERITY.MEDIUM) {
        // Escalation: If Medium risk site has sensitive forms, upgrade to Overlay
        const hasSensitiveForms = pageContent?.forms?.length > 0;
        return hasSensitiveForms ? ACTION.WARN_OVERLAY : ACTION.WARN_POPUP;
    }

    if (severity === SEVERITY.LOW) {
        return ACTION.WARN_POPUP;
    }

    return ACTION.ALLOW;
}

/**
 * Get cached scan result if available and not expired
 */
export async function getCachedResult(url) {
    try {
        const normalized = normalizeUrl(url);
        const cacheKey = `scan_cache_${normalized}`;
        const cached = await chrome.storage.local.get(cacheKey);

        if (cached[cacheKey]) {
            const { result, timestamp } = cached[cacheKey];
            const age = Date.now() - timestamp;
            const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours

            if (age < MAX_CACHE_AGE) {
                console.log('[Scam Detector] Using cached result for:', normalized);

                // BUG-076: Normalize legacy cache schemas lacking canonical overallSeverity mapping
                if (result && typeof result === 'object') {
                    if (result.overallSeverity === undefined && result.severity) {
                        result.overallSeverity = result.severity;
                    }
                    if (result.overallThreat === undefined && result.severity) {
                        result.overallThreat = result.severity === 'CRITICAL' || result.severity === 'HIGH';
                    }
                }

                return result;
            }
        }
    } catch (error) {
        console.error('[Scam Detector] Cache check error:', error);
    }
    return null;
}

/**
 * Cache scan result
 */
export async function cacheResult(url, result) {
    try {
        const normalized = normalizeUrl(url);
        const cacheKey = `scan_cache_${normalized}`;
        await chrome.storage.local.set({
            [cacheKey]: {
                result,
                timestamp: Date.now()
            }
        });
    } catch (error) {
        console.error('[Scam Detector] Cache save error:', error);
    }
}

/**
 * Scan URL with caching
 */
export async function scanUrlWithCache(url, options = {}) {
    const cached = await getCachedResult(url);
    if (cached && !options.forceRefresh) {
        return { ...cached, fromCache: true };
    }
    const result = await scanUrl(url, options);
    await cacheResult(url, result);
    return { ...result, fromCache: false };
}
