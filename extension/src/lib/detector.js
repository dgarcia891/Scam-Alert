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
import { extractHostname } from './analyzer/url-engine.js';
import { verifyWithAI } from './ai-verifier.js';
import { checkAICanRun, incrementRateCounters } from './ai-rate-limiter.js';
import { recordAICall } from './ai-telemetry.js';

/**
 * Main scan function that combines all detection methods
 * @param {string} url - URL to scan
 * @param {Object} options - Scan options
 * @param {Function} onProgress - Optional callback for progress updates
 * @returns {Promise<Object>} - Canonical ScanResult
 */
export async function scanUrl(url, options = {}, onProgress = null) {
    const scanStartTime = Date.now();

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

    console.log(`[Hydra Guard] Scanning: ${url}`);
    reportProgress(10, 'Initializing scan...');

    const timing = {
        total: 0,
        blocklist: 0,
        patterns: 0,
        phishtank: 0,
        gsb: 0,
        ai: 0,
    };

    // 1. Check Blocklist (User Override)
    const blocklistStart = Date.now();
    if (await isBlocked(url)) {
        timing.blocklist = Date.now() - blocklistStart;
        timing.total = Date.now() - scanStartTime;
        return createScanResult({
            severity: SEVERITY.CRITICAL,
            confidence: 'CERTAIN',
            action: ACTION.BLOCK,
            reasons: [{ code: 'USER_BLOCK', message: 'Site is in your personal blocklist' }],
            signals: { hard: ['USER_BLOCK'], soft: [] },
            meta: { timing }
        });
    }
    timing.blocklist = Date.now() - blocklistStart;

    const hardSignals = [];
    const softSignals = [];
    const reasons = [];
    const sources = [];

    // Track local checks by default
    sources.push({ id: 'local_patterns', status: 'success' });

    let finalChecks = {};

    // 2. Local Pattern Analysis
    const patternsStart = Date.now();
    if (usePatternDetection) {
        reportProgress(20, 'Analyzing URL patterns...');
        const customPhrases = await getMergedScamPhrases();
        const patterns = await analyzeUrl(url, pageContent, options.isPro, customPhrases);

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
    timing.patterns = Date.now() - patternsStart;

    // 3. Check PhishTank (Offline/Online)
    const phishtankStart = Date.now();
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
    timing.phishtank = Date.now() - phishtankStart;

    // 4. Check Google Safe Browsing
    const gsbStart = Date.now();
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
    timing.gsb = Date.now() - gsbStart;

    // 5. Determine Severity & Action
    let severity = determineSeverity({ hard: hardSignals, soft: softSignals });

    // 5.5 AI Second Opinion (FEAT-088)
    const aiStart = Date.now();
    let aiVerification = null;
    if (options.aiEnabled && options.aiApiKey &&
        severity !== SEVERITY.SAFE && severity !== SEVERITY.LOW) {

        reportProgress(80, 'AI Second Opinion analysis...');
        const rateCheck = await checkAICanRun(url, options);

        if (rateCheck.allowed) {
            const startTime = Date.now();
            const phrases = (finalChecks.emailScams?.visualIndicators || []).map(i => i.phrase);
            const intentKeywords = finalChecks.emailScams?.evidence?.detectedBrands || [];

            // withTimeout helper (inline)
            const withTimeout = (promise, ms, fallback) => {
                let timeoutId;
                const timeout = new Promise(resolve => {
                    timeoutId = setTimeout(() => resolve(fallback), ms);
                });
                return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
            };

            const aiResult = await withTimeout(
                verifyWithAI(url, { signals: [...hardSignals, ...softSignals], phrases, intentKeywords }, { apiKey: options.aiApiKey }),
                4000,
                { verdict: 'CONFIRMED', reason: 'AI validation timed out.', confidence: 50 }
            );
            const latencyMs = Date.now() - startTime;

            // Apply verdict (Safety First: Downgrade only if high confidence >= 70)
            const prevSeverity = severity;
            if (aiResult.verdict === 'DOWNGRADED' && aiResult.confidence >= 70) {
                severity = SEVERITY.LOW;
            } else if (aiResult.verdict === 'ESCALATED') {
                severity = SEVERITY.CRITICAL;
            }

            // Record telemetry
            await recordAICall({ url, localSeverity: prevSeverity, ...aiResult, latencyMs });
            await incrementRateCounters(new URL(url).hostname);

            aiVerification = {
                title: 'ai_second_opinion',
                description: 'Gemini AI cross-validated the local detection result.',
                flagged: aiResult.verdict !== 'DOWNGRADED',
                severity: severity,
                details: aiResult.verdict === 'DOWNGRADED'
                    ? `AI review suggests this is likely safe (confidence: ${aiResult.confidence}%). Stay cautious.`
                    : aiResult.reason,
                confidence: aiResult.confidence,
                verdict: aiResult.verdict,
                dataChecked: new URL(url).hostname
            };

            finalChecks.aiVerification = aiVerification;
        } else {
            console.log('[Detector] AI skipped:', rateCheck.reason);
        }
    }
    timing.ai = Date.now() - aiStart;

    const action = determineAction(severity, pageContent);

    timing.total = Date.now() - scanStartTime;

    reportProgress(100, 'Scan complete');

    return createScanResult({
        severity,
        confidence: hardSignals.length > 0 ? 'HIGH' : (softSignals.length > 0 ? 'MEDIUM' : 'LOW'),
        action,
        reasons,
        signals: { hard: hardSignals, soft: softSignals },
        checks: finalChecks,
        meta: { sources, aiVerification, timing }
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
                console.log('[Hydra Guard] Using cached result for:', normalized);

                // BUG-076: Normalize legacy cache schemas lacking canonical overallSeverity mapping
                if (result && typeof result === 'object') {
                    if (result.overallSeverity === undefined && result.severity) {
                        result.overallSeverity = result.severity;
                    }
                    if (result.overallThreat === undefined && result.severity) {
                        result.overallThreat = result.severity === 'CRITICAL' || result.severity === 'HIGH';
                    }
                }

                return { result, timestamp };
            }
        }
    } catch (error) {
        console.error('[Hydra Guard] Cache check error:', error);
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
        console.error('[Hydra Guard] Cache save error:', error);
    }
}

/**
 * Scan URL with caching
 */
export async function scanUrlWithCache(url, options = {}) {
    const cached = await getCachedResult(url);
    if (cached && !options.forceRefresh) {
        const { result, timestamp } = cached;
        if (!result.meta) result.meta = {};
        result.meta.cached = true;
        result.meta.cacheAge = Date.now() - timestamp;
        return { ...result, fromCache: true };
    }
    const result = await scanUrl(url, options);
    if (!result.meta) result.meta = {};
    result.meta.cached = false;
    await cacheResult(url, result);
    return { ...result, fromCache: false };
}
