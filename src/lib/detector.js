/**
 * Unified Scam Detection API
 * 
 * This module combines multiple detection services into a single interface:
 * - Google Safe Browsing API
 * - PhishTank (online and offline)
 * - Pattern-based detection
 * 
 * It intelligently cascades through services based on confidence and performance
 */

// Import individual detection modules
import { checkUrl } from './google-safe-browsing.js';
import { checkUrlWithPhishTank, checkUrlOffline } from './phishtank.js';
import { analyzeUrl } from './pattern-analyzer.js';

/**
 * Main scan function that combines all detection methods
 * @param {string} url - URL to scan
 * @param {Object} options - Scan options
 * @param {Function} onProgress - Optional callback for progress updates
 * @returns {Promise<Object>} - Combined scan results
 */
async function scanUrl(url, options = {}, onProgress = null) {
    const {
        useGoogleSafeBrowsing = true,
        usePhishTank = true,
        usePatternDetection = true,
        pageContent = null,
        preferOffline = false,
        gsbApiKey = '',
        phishTankApiKey = ''
    } = options;

    const reportProgress = (percent, message) => {
        if (onProgress) onProgress({ percent, message });
    };

    console.log(`[Scam Detector] Scanning: ${url}`);
    reportProgress(10, 'Initializing scan...');

    const results = {
        url,
        timestamp: new Date().toISOString(),
        detections: {},
        overallThreat: false,
        overallSeverity: 'SAFE',
        recommendations: []
    };

    // Test mode: allow safe end-to-end testing via a URL marker.
    // Example: https://example.com/#scam-alert-test=phishing
    if (url.includes('scam-alert-test=phishing')) {
        console.log('[Scam Detector] Test mode triggered: phishing');
        reportProgress(20, 'Analyzing URL patterns...');

        if (usePatternDetection) {
            results.detections.pattern = analyzeUrl(url, pageContent);
        }

        if (useGoogleSafeBrowsing) {
            results.detections.googleSafeBrowsing = {
                safe: false,
                threatType: 'SOCIAL_ENGINEERING',
                platformType: 'ANY_PLATFORM',
                severity: 'CRITICAL',
                testMode: true
            };
        }

        results.overallThreat = true;
        results.overallSeverity = 'CRITICAL';
        results.recommendations.push('Test mode: this is a simulated warning for testing');
        results.report = generateCategorizedReport(results.detections, results.overallSeverity);
        reportProgress(100, 'Scan complete (Test mode)');
        return results;
    }

    try {
        // Phase 1: Quick pattern-based detection (always runs first, no API calls)
        if (usePatternDetection) {
            console.log('[Scam Detector] Running pattern detection...');
            reportProgress(20, 'Analyzing URL patterns...');
            const patternResult = analyzeUrl(url, pageContent);
            results.detections.pattern = patternResult;

            // If pattern detection shows critical risk, we can skip API calls
            if (patternResult.riskScore >= 70) {
                console.log('[Scam Detector] Critical risk detected by patterns, flagging immediately');
                results.overallThreat = true;
                results.overallSeverity = 'CRITICAL';
                results.recommendations.push(patternResult.recommendation);
                reportProgress(100, 'Scan complete (Threat detected)');
                return results;
            }
        }

        // Phase 2: Check offline PhishTank database (fast, no API calls)
        if (usePhishTank && preferOffline) {
            console.log('[Scam Detector] Checking offline PhishTank database...');
            reportProgress(40, 'Checking threat database...');
            try {
                const phishTankResult = await checkUrlOffline(url);
                results.detections.phishTankOffline = phishTankResult;

                if (phishTankResult.isPhishing) {
                    results.overallThreat = true;
                    results.overallSeverity = 'CRITICAL';
                    results.recommendations.push('Known phishing site - DO NOT PROCEED');
                    reportProgress(100, 'Scan complete (Threat detected)');
                    return results;
                }
            } catch (error) {
                console.warn('[Scam Detector] Offline PhishTank check failed:', error);
            }
        }

        // Phase 3: Run API checks in parallel (if needed)
        const apiChecks = [];

        if (useGoogleSafeBrowsing) {
            console.log('[Scam Detector] Querying Google Safe Browsing...');
            reportProgress(60, 'Consulting Google Safe Browsing...');
            apiChecks.push(
                checkUrl(url, gsbApiKey)
                    .then(result => ({ service: 'googleSafeBrowsing', result }))
                    .catch(error => ({ service: 'googleSafeBrowsing', error: error.message }))
            );
        }

        if (usePhishTank && !preferOffline) {
            console.log('[Scam Detector] Querying PhishTank API...');
            reportProgress(80, 'Verifying with PhishTank...');
            apiChecks.push(
                checkUrlWithPhishTank(url, { apiKey: phishTankApiKey })
                    .then(result => ({ service: 'phishTank', result }))
                    .catch(error => ({ service: 'phishTank', error: error.message }))
            );
        }

        // Wait for all API checks to complete
        if (apiChecks.length > 0) {
            const apiResults = await Promise.all(apiChecks);

            // Process API results
            apiResults.forEach(({ service, result, error }) => {
                if (error) {
                    console.error(`[Scam Detector] ${service} error:`, error);
                    results.detections[service] = { error };
                    return;
                }

                results.detections[service] = result;

                // Check for threats
                if (service === 'googleSafeBrowsing' && !result.safe) {
                    results.overallThreat = true;
                    results.overallSeverity = result.severity;
                    results.recommendations.push(`Google Safe Browsing flagged as ${result.threatType}`);
                }

                if (service === 'phishTank' && result.isPhishing) {
                    results.overallThreat = true;
                    results.overallSeverity = 'CRITICAL';
                    results.recommendations.push('PhishTank confirmed phishing - DO NOT PROCEED');
                }
            });
        }

        // Phase 4: Combine all results and determine final verdict
        results.overallSeverity = determineOverallSeverity(results.detections);
        results.report = generateCategorizedReport(results.detections, results.overallSeverity);

        if (!results.overallThreat && results.overallSeverity !== 'SAFE') {
            results.recommendations.push('Proceed with caution - suspicious indicators detected');
        }

        console.log('[Scam Detector] Scan complete:', results.overallSeverity);
        reportProgress(100, 'Scan complete');
        return results;

    } catch (error) {
        console.error('[Scam Detector] Scan error:', error);
        return {
            ...results,
            error: error.message,
            overallSeverity: 'UNKNOWN'
        };
    }
}

/**
 * Generate a categorized risk report from detections
 * @param {Object} detections - Raw detection results
 * @param {string} overallSeverity - Combined severity
 * @returns {Object} - Categorized report
 */
function generateCategorizedReport(detections, overallSeverity) {
    const report = {
        fraud: { status: 'SAFE', label: 'Trustworthy' },
        identity: { status: 'SAFE', label: 'Privacy' },
        malware: { status: 'SAFE', label: 'Security' },
        deceptive: { status: 'SAFE', label: 'Honesty' },
        summary: 'We checked this website and it appears to be safe.',
        indicators: [] // New: list of specific reasons
    };

    // 1. PhishTank & GSB Social Engineering -> Fraud
    if (detections.phishTank?.isPhishing || detections.phishTankOffline?.isPhishing) {
        report.fraud.status = 'CRITICAL';
        report.indicators.push('Flagged by PhishTank community database');
    }
    if (detections.googleSafeBrowsing?.threatType === 'SOCIAL_ENGINEERING') {
        report.fraud.status = 'CRITICAL';
        report.indicators.push('Google Safe Browsing flagged as Social Engineering');
    }

    // 2. Pattern Analysis (Typosquatting/Obfuscation) -> Identity
    const p = detections.pattern;
    if (p) {
        if (p.checks.typosquatting.flagged) {
            report.identity.status = 'CRITICAL';
            report.indicators.push(`Possible brand impersonation: ${p.checks.typosquatting.suspectedBrand}`);
        }
        if (p.checks.urlObfuscation.flagged) {
            report.identity.status = Math.max(report.identity.status === 'CRITICAL' ? 2 : 0, p.checks.urlObfuscation.score > 20 ? 2 : 1) === 2 ? 'CRITICAL' : 'CAUTION';
            report.indicators.push(`Suspicious URL obfuscation: ${p.checks.urlObfuscation.details}`);
        }
    }

    // 3. GSB Malware -> Malware
    if (detections.googleSafeBrowsing?.threatType === 'MALWARE' ||
        detections.googleSafeBrowsing?.threatType === 'UNWANTED_SOFTWARE') {
        report.malware.status = 'CRITICAL';
        report.indicators.push(`Malicious software detected: ${detections.googleSafeBrowsing.threatType}`);
    }

    // 4. Pattern Analysis (Suspicious Content/TLD) -> Deceptive
    if (p) {
        if (p.checks.nonHttps?.flagged) {
            report.deceptive.status = 'CAUTION';
            report.indicators.push('Connection not secure (HTTP)');
        }
        if (p.checks.suspiciousTLD.flagged) {
            report.deceptive.status = 'CAUTION';
            report.indicators.push(`Suspicious top-level domain: ${p.checks.suspiciousTLD.details}`);
        }
        if (p.checks.suspiciousKeywords.flagged) {
            report.deceptive.status = 'CAUTION';
            report.indicators.push(`Found suspicious keywords: ${p.checks.suspiciousKeywords.keywords.join(', ')}`);
        }
        if (p.checks.ipAddress.flagged) {
            report.deceptive.status = 'CAUTION';
            report.indicators.push('Site uses IP address instead of domain name');
        }
    }

    // Update summary based on severity
    if (overallSeverity === 'CRITICAL') {
        report.summary = 'We found some concerns with this website. We recommend leaving this page.';
    } else if (overallSeverity === 'CAUTION' || (overallSeverity !== 'SAFE' && report.indicators.length > 0)) {
        report.summary = 'We noticed a few things that seem unusual. Please be careful here.';
    }

    return report;
}

/**
 * Determine overall severity from multiple detection results
 * @param {Object} detections - All detection results
 * @returns {string} - Overall severity level
 */
function determineOverallSeverity(detections) {
    const severityLevels = {
        'CRITICAL': 4,
        'HIGH': 3,
        'MEDIUM': 2,
        'LOW': 1,
        'SAFE': 0
    };

    let maxSeverity = 'SAFE';
    let maxLevel = 0;

    Object.values(detections).forEach(detection => {
        if (!detection || detection.error) return;

        const severity = detection.severity || detection.riskLevel;
        const level = severityLevels[severity] || 0;

        if (level > maxLevel) {
            maxLevel = level;
            maxSeverity = severity;
        }
    });

    return maxSeverity;
}

/**
 * Batch scan multiple URLs
 * @param {string[]} urls - URLs to scan
 * @param {Object} options - Scan options
 * @returns {Promise<Object>} - Results for all URLs
 */
async function batchScanUrls(urls, options = {}) {
    console.log(`[Scam Detector] Batch scanning ${urls.length} URLs`);

    const results = {};

    // Scan in parallel with rate limiting
    const BATCH_SIZE = 5; // Scan 5 at a time to avoid API rate limits

    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        const batch = urls.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
            batch.map(url => scanUrl(url, options))
        );

        batchResults.forEach(result => {
            results[result.url] = result;
        });

        // Small delay between batches
        if (i + BATCH_SIZE < urls.length) {
            await sleep(1000);
        }
    }

    return results;
}

/**
 * Check if URL should be scanned (filter out internal/safe URLs)
 * @param {string} url - URL to check
 * @returns {boolean} - True if should scan
 */
function shouldScanUrl(url) {
    try {
        const urlObj = new URL(url);

        // Skip chrome:// and extension:// URLs
        if (urlObj.protocol === 'chrome:' || urlObj.protocol === 'chrome-extension:') {
            return false;
        }

        // Skip localhost and private IPs
        if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
            return false;
        }

        // Skip data: and blob: URLs
        if (urlObj.protocol === 'data:' || urlObj.protocol === 'blob:') {
            return false;
        }

        // Skip known safe domains (whitelist)
        const safeDomains = [
            'google.com', 'youtube.com', 'facebook.com', 'twitter.com',
            'github.com', 'stackoverflow.com', 'wikipedia.org'
        ];

        const hostname = urlObj.hostname.replace(/^www\./, '');
        if (safeDomains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))) {
            return false;
        }

        return true;

    } catch {
        return false;
    }
}

/**
 * Sleep helper function
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Resolves after delay
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get cached scan result if available and not expired
 * @param {string} url - URL to check cache for
 * @returns {Promise<Object|null>} - Cached result or null
 */
async function getCachedResult(url) {
    try {
        const cacheKey = `scan_cache_${url}`;
        const cached = await chrome.storage.local.get(cacheKey);

        if (cached[cacheKey]) {
            const { result, timestamp } = cached[cacheKey];
            const age = Date.now() - timestamp;
            const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours

            if (age < MAX_CACHE_AGE) {
                console.log('[Scam Detector] Using cached result for:', url);
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
 * @param {string} url - URL that was scanned
 * @param {Object} result - Scan result to cache
 */
async function cacheResult(url, result) {
    try {
        const cacheKey = `scan_cache_${url}`;
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
 * @param {string} url - URL to scan
 * @param {Object} options - Scan options
 * @returns {Promise<Object>} - Scan results
 */
async function scanUrlWithCache(url, options = {}) {
    // Check cache first
    const cached = await getCachedResult(url);
    if (cached && !options.forceRefresh) {
        return { ...cached, fromCache: true };
    }

    // Perform scan
    const result = await scanUrl(url, options);

    // Cache result
    await cacheResult(url, result);

    return { ...result, fromCache: false };
}

// Export functions
export {
    scanUrl,
    scanUrlWithCache,
    batchScanUrls,
    shouldScanUrl,
    getCachedResult,
    cacheResult
};
