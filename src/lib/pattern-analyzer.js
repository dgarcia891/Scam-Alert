/**
 * Pattern-Based Scam Detection
 * 
 * This module uses heuristics and pattern matching to detect potential scams
 * without relying on external APIs. Useful as a first line of defense or
 * when API limits are reached.
 * 
 * Common scam patterns:
 * - Suspicious TLDs (.tk, .ml, .ga, etc.)
 * - URL obfuscation techniques
 * - Fake brand lookalikes (typosquatting)
 * - Common scam keywords
 */

/**
 * Analyze URL for suspicious patterns
 * @param {string} url - URL to analyze
 * @param {Object} pageContent - Optional page content for deeper analysis
 * @returns {Object} - Analysis results with risk score
 */
function analyzeUrl(url, pageContent = null) {
    const checks = {
        nonHttps: checkNonHttps(url),
        suspiciousTLD: checkSuspiciousTLD(url),
        typosquatting: checkTyposquatting(url),
        urlObfuscation: checkUrlObfuscation(url),
        ipAddress: checkIPAddress(url),
        excessiveSubdomains: checkExcessiveSubdomains(url),
        suspiciousKeywords: checkSuspiciousKeywords(url)
    };

    // If page content provided, do content analysis
    if (pageContent) {
        checks.contentAnalysis = analyzePageContent(pageContent);
    }

    // Calculate risk score (0-100)
    const riskScore = calculateRiskScore(checks);

    return {
        url,
        riskScore,
        riskLevel: getRiskLevel(riskScore),
        checks,
        recommendation: getRecommendation(riskScore),
        timestamp: new Date().toISOString()
    };
}

/**
 * Check whether the connection is encrypted (HTTPS)
 * @param {string} url - URL to check
 * @returns {Object} - Check result
 */
function checkNonHttps(url) {
    try {
        const urlObj = new URL(url);
        const isHttp = urlObj.protocol.toLowerCase() === 'http:';

        return {
            flagged: isHttp,
            severity: isHttp ? 'LOW' : 'NONE',
            details: isHttp ? 'Connection is not secure (HTTP)' : 'Secure connection (HTTPS)',
            // Set to the LOW threshold so HTTP reliably shows as a caution state.
            score: isHttp ? 15 : 0
        };
    } catch {
        // If parsing fails, do not flag based on protocol.
        return {
            flagged: false,
            severity: 'NONE',
            details: 'Unknown connection security',
            score: 0
        };
    }
}

/**
 * Check for suspicious top-level domains
 * @param {string} url - URL to check
 * @returns {Object} - Check result
 */
function checkSuspiciousTLD(url) {
    const suspiciousTLDs = [
        // Free domains often used in scams
        '.tk', '.ml', '.ga', '.cf', '.gq',
        // Other suspicious TLDs
        '.top', '.xyz', '.work', '.click', '.link',
        '.loan', '.download', '.racing', '.accountant'
    ];

    const hostname = extractHostname(url);
    const tld = hostname.substring(hostname.lastIndexOf('.'));

    const isSuspicious = suspiciousTLDs.some(suspTLD =>
        tld.toLowerCase() === suspTLD
    );

    return {
        flagged: isSuspicious,
        severity: isSuspicious ? 'MEDIUM' : 'NONE',
        details: isSuspicious ? `Suspicious TLD: ${tld}` : 'TLD is normal',
        score: isSuspicious ? 20 : 0
    };
}

/**
 * Check for typosquatting (brand impersonation)
 * @param {string} url - URL to check
 * @returns {Object} - Check result
 */
function checkTyposquatting(url) {
    // Common brands that scammers impersonate
    const popularBrands = [
        'paypal', 'amazon', 'google', 'facebook', 'microsoft',
        'apple', 'netflix', 'instagram', 'twitter', 'chase',
        'bankofamerica', 'wellsfargo', 'irs', 'usps', 'fedex',
        'ebay', 'walmart', 'target'
    ];

    const hostname = extractHostname(url).toLowerCase();

    for (const brand of popularBrands) {
        // Check if hostname contains brand but isn't the legitimate domain
        // Refinement: Ignore if the brand is part of a longer legitimate-looking TLD or subdomain Part 
        if (hostname.includes(brand) && !isLegitimateUrl(hostname, brand)) {
            // Check if it's just a common word that happens to be a brand (e.g. 'google' vs 'google-search')
            // but don't flag if it's clearly a subdomain of a safe domain (already handled by shouldScan, but being safe)
            const brandPattern = new RegExp(`(^|\\.)${brand}($|\\.)`);
            const looksLikeImpersonation = !brandPattern.test(hostname) || hostname !== brand;

            if (looksLikeImpersonation) {
                return {
                    flagged: true,
                    severity: 'HIGH',
                    details: `Possible impersonation of ${brand}`,
                    suspectedBrand: brand,
                    score: 40
                };
            }
        }
    }

    return {
        flagged: false,
        severity: 'NONE',
        details: 'No typosquatting detected',
        score: 0
    };
}

/**
 * Check if hostname is legitimate for a brand
 * @param {string} hostname - Hostname to check
 * @param {string} brand - Brand name
 * @returns {boolean} - True if legitimate
 */
function isLegitimateUrl(hostname, brand) {
    const legitimateDomains = {
        'paypal': ['paypal.com', 'paypal-business.com'],
        'amazon': ['amazon.com', 'amazon.co.uk', 'amazonwebservices.com'],
        'google': ['google.com', 'gmail.com', 'youtube.com', '.google'],
        'microsoft': ['microsoft.com', 'live.com', 'outlook.com'],
        'apple': ['apple.com', 'icloud.com'],
        // Add more as needed
    };

    const legitDomains = legitimateDomains[brand] || [`${brand}.com`];
    return legitDomains.some((domain) => {
        if (domain.startsWith('.')) {
            // Allow special-cased registrable TLDs (e.g. *.google)
            return hostname.endsWith(domain);
        }
        return hostname === domain || hostname.endsWith(`.${domain}`);
    });
}

/**
 * Check for URL obfuscation techniques
 * @param {string} url - URL to check
 * @returns {Object} - Check result
 */
function checkUrlObfuscation(url) {
    const patterns = {
        excessiveHyphens: /-{3,}/,
        hexEncoding: /%[0-9A-F]{2}/gi,
        dataUri: /^data:/i,
        unusualProtocol: /^(?!https?:\/\/)/i,
        atSymbol: /@/  // Used to hide actual domain
    };

    const flagged = [];
    let totalScore = 0;

    if (patterns.excessiveHyphens.test(url)) {
        flagged.push('Excessive hyphens');
        totalScore += 15;
    }

    const hexMatches = url.match(patterns.hexEncoding);
    if (hexMatches && hexMatches.length > 3) {
        flagged.push('Excessive URL encoding');
        totalScore += 20;
    }

    if (patterns.dataUri.test(url)) {
        flagged.push('Data URI scheme');
        totalScore += 25;
    }

    if (patterns.atSymbol.test(url)) {
        flagged.push('@ symbol (potential domain hiding)');
        totalScore += 30;
    }

    return {
        flagged: flagged.length > 0,
        severity: totalScore > 30 ? 'HIGH' : (totalScore > 15 ? 'MEDIUM' : 'NONE'),
        details: flagged.length > 0 ? flagged.join(', ') : 'No obfuscation detected',
        patterns: flagged,
        score: totalScore
    };
}

/**
 * Check if URL uses IP address instead of domain
 * @param {string} url - URL to check
 * @returns {Object} - Check result
 */
function checkIPAddress(url) {
    const hostname = extractHostname(url);
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    const isIP = ipPattern.test(hostname);

    return {
        flagged: isIP,
        severity: isIP ? 'MEDIUM' : 'NONE',
        details: isIP ? 'Using IP address instead of domain' : 'Using domain name',
        score: isIP ? 25 : 0
    };
}

/**
 * Check for excessive subdomains
 * @param {string} url - URL to check
 * @returns {Object} - Check result
 */
function checkExcessiveSubdomains(url) {
    const hostname = extractHostname(url);
    const parts = hostname.split('.');
    const subdomainCount = parts.length - 2; // Minus domain and TLD

    const excessive = subdomainCount > 3;

    return {
        flagged: excessive,
        severity: excessive ? 'LOW' : 'NONE',
        details: `${subdomainCount} subdomain(s)`,
        subdomainCount,
        score: excessive ? 10 : 0
    };
}

/**
 * Check for suspicious keywords in URL
 * @param {string} url - URL to check
 * @returns {Object} - Check result
 */
function checkSuspiciousKeywords(url) {
    const keywords = [
        'login', 'signin', 'verify', 'update', 'secure', 'account',
        'banking', 'suspend', 'locked', 'urgent', 'confirm',
        'billing', 'payment', 'wallet', 'alert', 'warning'
    ];

    const keywordExplanations = {
        login: 'Common on real sites, but often used on fake sign-in pages to steal passwords.',
        signin: 'Common on real sites, but often used on fake sign-in pages to steal passwords.',
        verify: 'Often used to pressure you to confirm details (a common phishing tactic).',
        update: 'Often used to push you to “update” information quickly (common in scams).',
        secure: 'Can be used to create a false sense of safety (words do not guarantee security).',
        account: 'Often appears in account takeover scams and fake login flows.',
        banking: 'High-risk context: scammers often impersonate banks and financial portals.',
        suspend: 'Pressure tactic: “account suspended” messages are common in phishing.',
        locked: 'Pressure tactic: “account locked” messages are common in phishing.',
        urgent: 'Pressure tactic used to rush decisions and bypass caution.',
        confirm: 'Often used to pressure you to confirm personal info or credentials.',
        billing: 'Payment-related context; scammers may request billing info.',
        payment: 'Payment-related context; scammers may request card or payment details.',
        wallet: 'Payment-related context; scammers may request access to wallets/accounts.',
        alert: 'Often used to create urgency or fear (e.g., “security alert”).',
        warning: 'Often used to create urgency or fear and push quick action.'
    };

    const lowerUrl = url.toLowerCase();
    const found = keywords.filter(keyword => lowerUrl.includes(keyword));

    // Only flag if multiple suspicious keywords in non-HTTPS or suspicious domains
    // Refinement: Be less aggressive on secure HTTPS sites from reputable TLDs
    const isSuspiciousTLD = checkSuspiciousTLD(url).flagged;
    const flagged = found.length >= 3 || (found.length >= 2 && (!url.startsWith('https://') || isSuspiciousTLD));

    let reasonSummary = '';
    if (!flagged && found.length > 0) {
        if (found.length === 1) {
            reasonSummary = 'Only one keyword found. Single keywords are common on normal sites.';
        } else {
            reasonSummary = url.startsWith('https://') && !isSuspiciousTLD
                ? 'Multiple keywords found, but this is HTTPS and uses a normal domain ending, so we did not flag it.'
                : 'Multiple keywords found, but not enough signals to flag it.';
        }
    }

    const keywordReasons = {};
    found.forEach((k) => {
        keywordReasons[k] = keywordExplanations[k] || 'This keyword can appear in scam or phishing URLs.';
    });

    return {
        flagged,
        severity: flagged ? 'MEDIUM' : 'NONE',
        details: flagged
            ? `Suspicious keywords: ${found.join(', ')}`
            : (found.length > 0 ? `Found keywords: ${found.join(', ')}` : 'No suspicious keywords'),
        keywords: found,
        keywordReasons,
        reasonSummary,
        score: flagged ? found.length * 5 : 0
    };
}

/**
 * Analyze page content for scam indicators
 * @param {Object} pageContent - Page content (title, text, forms)
 * @returns {Object} - Analysis result
 */
function analyzePageContent(pageContent) {
    const {
        title = '',
        bodyText = '',
        forms = [],
        linkMismatches = [],
        isHttps = true
    } = pageContent || {};

    const scamPhrases = [
        'you have won', 'claim your prize', 'act now', 'limited time',
        'your account has been suspended', 'verify your identity',
        'urgent action required', 'confirm your information',
        'click here immediately', 'your computer is infected',
        'call this number now', 'refund pending', 'tax refund'
    ];

    const text = (title + ' ' + bodyText).toLowerCase();
    const foundPhrases = scamPhrases.filter(phrase => text.includes(phrase));

    const sensitiveForms = Array.isArray(forms)
        ? forms.filter(form => (form.hasPassword || form.hasCreditCard))
        : [];

    const insecureForms = !isHttps
        ? sensitiveForms
        : [];

    const suspiciousLinks = Array.isArray(linkMismatches)
        ? linkMismatches.slice(0, 5)
        : [];

    let score = foundPhrases.length * 10;
    let severity = 'NONE';

    if (foundPhrases.length >= 2) {
        severity = 'HIGH';
    } else if (foundPhrases.length > 0) {
        severity = 'MEDIUM';
    }

    if (insecureForms.length > 0) {
        score += 40;
        severity = elevateSeverity(severity, 'HIGH');
    }

    if (suspiciousLinks.length > 0) {
        score += 20;
        severity = elevateSeverity(severity, 'MEDIUM');
    }

    const flagged =
        foundPhrases.length > 0 ||
        insecureForms.length > 0 ||
        suspiciousLinks.length > 0;

    const detailSegments = [];
    if (foundPhrases.length > 0) {
        detailSegments.push(`Urgent wording: ${foundPhrases.join(', ')}`);
    }
    if (insecureForms.length > 0) {
        detailSegments.push('Sensitive form on non-secure (HTTP) page');
    }
    if (suspiciousLinks.length > 0) {
        detailSegments.push('Links where the text does not match the destination');
    }

    let details = '';
    if (detailSegments.length > 0) {
        details = detailSegments.join('; ');
    } else if (sensitiveForms.length > 0) {
        details = 'Sensitive form present (connection appears secure).';
    } else {
        details = 'No risky forms or disguised links found.';
    }

    return {
        flagged,
        severity,
        scamPhrases: foundPhrases,
        hasPasswordInput: sensitiveForms.length > 0,
        insecureForms,
        suspiciousLinks,
        details,
        score
    };
}

function elevateSeverity(current, incoming) {
    const order = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const currentIndex = order.indexOf(current);
    const incomingIndex = order.indexOf(incoming);
    return incomingIndex > currentIndex ? incoming : current;
}

/**
 * Calculate overall risk score
 * @param {Object} checks - All check results
 * @returns {number} - Risk score (0-100)
 */
function calculateRiskScore(checks) {
    let totalScore = 0;

    Object.values(checks).forEach(check => {
        if (check && check.score) {
            totalScore += check.score;
        }
    });

    // Cap at 100
    return Math.min(totalScore, 100);
}

/**
 * Get risk level from score
 * @param {number} score - Risk score
 * @returns {string} - Risk level
 */
function getRiskLevel(score) {
    if (score >= 70) return 'CRITICAL';
    if (score >= 50) return 'HIGH';
    if (score >= 30) return 'MEDIUM';
    if (score >= 15) return 'LOW';
    return 'SAFE';
}

/**
 * Get recommendation based on risk score
 * @param {number} score - Risk score
 * @returns {string} - Recommendation
 */
function getRecommendation(score) {
    if (score >= 70) return 'DO NOT PROCEED - High risk of scam';
    if (score >= 50) return 'Proceed with extreme caution';
    if (score >= 30) return 'Be cautious - verify before entering any information';
    if (score >= 15) return 'Exercise normal caution';
    return 'Appears safe';
}

/**
 * Extract hostname from URL
 * @param {string} url - URL to parse
 * @returns {string} - Hostname
 */
function extractHostname(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch {
        return url;
    }
}

// Export functions
export {
    analyzeUrl,
    checkSuspiciousTLD,
    checkTyposquatting,
    checkUrlObfuscation,
    calculateRiskScore
};
