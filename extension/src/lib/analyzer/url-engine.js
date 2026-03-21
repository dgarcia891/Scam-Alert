/**
 * URL Heuristic Engine
 * Handles all detections based on the URL structure, domain, and path.
 */

export function extractHostname(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch {
        return url;
    }
}

export function getLevenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

export function isLegitimateUrl(hostname, brand) {
    const legitimateDomains = {
        'paypal': ['paypal.com', 'paypal-business.com'],
        'amazon': ['amazon.com', 'amazon.co.uk', 'amazonwebservices.com'],
        'google': ['google.com', 'gmail.com', 'youtube.com', 'google.dev', '.google'],
        'microsoft': ['microsoft.com', 'live.com', 'outlook.com'],
        'apple': ['apple.com', 'icloud.com'],
    };

    const legitDomains = legitimateDomains[brand] || [`${brand}.com`];
    return legitDomains.some((domain) => {
        if (domain.startsWith('.')) {
            return hostname.endsWith(domain);
        }
        return hostname === domain || hostname.endsWith(`.${domain}`);
    });
}

export function checkNonHttps(url) {
    try {
        const urlObj = new URL(url);
        const isHttp = urlObj.protocol.toLowerCase() === 'http:';
        return {
            title: 'check_non_https',
            description: 'Verifies if the website uses an encrypted (HTTPS) connection.',
            flagged: isHttp,
            severity: isHttp ? 'LOW' : 'NONE',
            details: isHttp ? 'Connection is not secure (HTTP)' : 'Secure connection (HTTPS)',
            dataChecked: url,
            score: isHttp ? 15 : 0
        };
    } catch {
        return { flagged: false, severity: 'NONE', details: 'Unknown connection security', score: 0 };
    }
}

export function checkSuspiciousTLD(url) {
    const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.gq', '.top', '.xyz', '.work', '.click', '.link', '.loan', '.download', '.racing', '.accountant'];
    const hostname = extractHostname(url);
    const tld = hostname.substring(hostname.lastIndexOf('.'));
    const isSuspicious = suspiciousTLDs.some(suspTLD => tld.toLowerCase() === suspTLD);
    return {
        title: 'check_suspicious_tld',
        description: 'Checks for top-level domains disproportionately used by scammers.',
        flagged: isSuspicious,
        severity: isSuspicious ? 'MEDIUM' : 'NONE',
        details: isSuspicious ? `Suspicious TLD: ${tld}` : 'TLD is normal',
        dataChecked: tld,
        score: isSuspicious ? 20 : 0
    };
}

export function checkTyposquatting(url) {
    const popularBrands = [
        'paypal', 'amazon', 'google', 'facebook', 'microsoft', 'apple', 'netflix', 'instagram', 'twitter', 'chase',
        'bankofamerica', 'wellsfargo', 'irs', 'usps', 'fedex', 'ebay', 'walmart', 'target'
    ];
    const hostname = extractHostname(url).toLowerCase();

    for (const brand of popularBrands) {
        if (hostname.includes(brand) && !isLegitimateUrl(hostname, brand)) {
            const brandPattern = new RegExp(`(^|\\.)${brand}($|\\.)`);
            if (!brandPattern.test(hostname) || hostname !== brand) {
                return {
                    title: 'check_typosquatting',
                    description: 'Detects domains that look almost identical to popular brands.',
                    flagged: true,
                    severity: 'HIGH',
                    details: `Possible impersonation of ${brand}`,
                    suspectedBrand: brand,
                    dataChecked: hostname,
                    score: 40
                };
            }
        }
    }
    return {
        title: 'check_typosquatting',
        description: 'Detects domains that look almost identical to popular brands.',
        flagged: false,
        severity: 'NONE',
        details: 'No typosquatting detected',
        dataChecked: hostname,
        score: 0
    };
}

export function checkUrlObfuscation(url, dynamicRules = []) {
    const ruleOverrides = {};
    dynamicRules.forEach(rule => {
        if (rule.rule_key && rule.rule_key.startsWith('urlObfuscation.') && rule.active) {
            const key = rule.rule_key.split('.')[1];
            try {
                let patternStr = rule.pattern_regex;
                let flags = 'i';
                if (patternStr.startsWith('/') && patternStr.lastIndexOf('/') > 0) {
                    const lastSlash = patternStr.lastIndexOf('/');
                    flags = patternStr.substring(lastSlash + 1);
                    patternStr = patternStr.substring(1, lastSlash);
                }
                ruleOverrides[key] = {
                    regex: new RegExp(patternStr, flags),
                    score: rule.score_weight || null
                };
            } catch (e) {
                console.warn('[Hydra Guard] Failed to compile dynamic heuristic rule:', rule.rule_key, e);
            }
        }
    });

    const patterns = {
        excessiveHyphens: ruleOverrides.excessiveHyphens?.regex || /-{3,}/,
        hexEncoding: ruleOverrides.hexEncoding?.regex || /%[0-9A-F]{2}/gi,
        dataUri: ruleOverrides.dataUri?.regex || /^data:/i,
        unusualProtocol: ruleOverrides.unusualProtocol?.regex || /^(?!https?:\/\/)/i,
        atSymbol: ruleOverrides.atSymbol?.regex || /@/
    };
    const flagged = [];
    let totalScore = 0;

    let urlObj;
    try {
        urlObj = new URL(url);
    } catch {
        // Fallback for malformed URLs
    }

    if (patterns.excessiveHyphens.test(url)) { 
        flagged.push('Excessive hyphens'); 
        totalScore += ruleOverrides.excessiveHyphens?.score ?? 15; 
    }
    
    // Baseline Fix 1: Only check for excessive hex encoding in origin and pathname, not query strings.
    const stringForHexCheck = urlObj ? (urlObj.origin + urlObj.pathname) : url;
    const hexMatches = stringForHexCheck.match(patterns.hexEncoding);
    if (hexMatches && hexMatches.length > 3) { 
        flagged.push('Excessive URL encoding'); 
        totalScore += ruleOverrides.hexEncoding?.score ?? 20; 
    }
    
    if (patterns.dataUri.test(url)) { 
        flagged.push('Data URI scheme'); 
        totalScore += ruleOverrides.dataUri?.score ?? 25; 
    }
    
    // Baseline Fix 2: Only flag @ symbol if it's used for basic auth domain obfuscation (e.g., https://google.com-login@scam.com/)
    if (urlObj) {
        if (urlObj.username || urlObj.password) {
            flagged.push('@ symbol (potential domain hiding)'); 
            totalScore += ruleOverrides.atSymbol?.score ?? 30;
        }
    } else if (patterns.atSymbol.test(url)) {
        flagged.push('@ symbol (potential domain hiding)'); 
        totalScore += ruleOverrides.atSymbol?.score ?? 30;
    }

    return {
        title: 'check_url_obfuscation',
        description: 'Looks for character encoding or @ symbols used to hide the actual destination.',
        flagged: flagged.length > 0,
        severity: totalScore > 30 ? 'HIGH' : (totalScore > 15 ? 'MEDIUM' : 'NONE'),
        details: flagged.length > 0 ? flagged.join(', ') : 'No obfuscation detected',
        patterns: flagged,
        dataChecked: url,
        score: totalScore
    };
}

export function checkIPAddress(url) {
    const hostname = extractHostname(url);
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    const isIP = ipPattern.test(hostname);
    return {
        title: 'check_ip_address',
        description: 'Flags websites that use a numeric IP address instead of a domain name.',
        flagged: isIP,
        severity: isIP ? 'MEDIUM' : 'NONE',
        details: isIP ? 'Using IP address instead of domain' : 'Using domain name',
        dataChecked: hostname,
        score: isIP ? 25 : 0
    };
}

export function checkExcessiveSubdomains(url) {
    const hostname = extractHostname(url);
    const parts = hostname.split('.');
    const subdomainCount = parts.length - 2;
    const excessive = subdomainCount > 3;
    return {
        title: 'check_excessive_subdomains',
        description: 'Checks for unusually long, complex URLs.',
        flagged: excessive,
        severity: excessive ? 'LOW' : 'NONE',
        details: `${subdomainCount} subdomain(s)`,
        subdomainCount,
        dataChecked: hostname,
        score: excessive ? 10 : 0
    };
}

export function checkAdvancedTyposquatting(url) {
    const highValueTargets = ['google', 'amazon', 'paypal', 'apple', 'microsoft', 'facebook', 'netflix', 'chase', 'wellsfargo', 'bankofamerica', 'binance', 'coinbase'];
    const hostname = extractHostname(url).toLowerCase();
    const parts = hostname.split('.');
    const mainPart = parts.length > 1 ? parts[parts.length - 2] : parts[0];

    for (const target of highValueTargets) {
        if (mainPart === target) continue;
        const distance = getLevenshteinDistance(mainPart, target);
        if (distance > 0 && distance <= 2 && target.length > 4) {
            return {
                title: 'check_advanced_typosquatting',
                description: 'Performs mathematical string similarity analysis to catch subtle misspellings of high-value targets.',
                flagged: true,
                severity: 'CRITICAL',
                details: `Domain name "${mainPart}" is suspiciously similar to "${target}"`,
                target,
                dataChecked: mainPart,
                score: 50
            };
        }
    }
    return {
        title: 'check_advanced_typosquatting',
        description: 'Performs mathematical string similarity analysis.',
        flagged: false,
        dataChecked: mainPart,
        score: 0
    };
}

/**
 * Checks for non-standard ports in URL, which are commonly used by scammers
 * to host payloads and avoid simple domain/port blocklists.
 * Standard ports: 80 (HTTP), 443 (HTTPS), 8080/8888 (common dev)
 */
export function checkSuspiciousPort(url) {
    const ALLOWED_PORTS = new Set([80, 443, 8080, 8888]);
    try {
        const urlObj = new URL(url);
        const port = urlObj.port; // Empty string if default port for the protocol

        if (port !== '' && !ALLOWED_PORTS.has(parseInt(port, 10))) {
            return {
                title: 'check_suspicious_port',
                description: 'Flags URLs using non-standard ports, a common technique to host payloads and bypass domain filters.',
                flagged: true,
                severity: 'MEDIUM',
                details: `Non-standard port detected: :${port}`,
                dataChecked: url,
                score: 25
            };
        }
    } catch (e) { /* ignore invalid URLs */ }

    return {
        title: 'check_suspicious_port',
        description: 'Flags URLs using non-standard ports.',
        flagged: false,
        severity: 'NONE',
        details: 'Standard port',
        dataChecked: url,
        score: 0
    };
}

/**
 * Detects multi-domain redirect chain phishing URLs.
 * These URLs abuse multiple @ symbols and embed many domain-like segments
 * (e.g., .co.uk, .net, .com) in the path to obfuscate the real destination.
 *
 * Example attack URL:
 *   https://x.org.uk/@/foo.co.uk/bvg@bar.com/@/baz.in.net/...
 */
export function checkRedirectChain(url) {
    if (!url || typeof url !== 'string') {
        return { title: 'check_redirect_chain', flagged: false, severity: 'NONE', score: 0, details: 'No URL', dataChecked: '' };
    }

    const flagged = [];
    let totalScore = 0;

    // 1. Multiple @ symbols — 2+ is a near-certain phishing signal
    const atCount = (url.match(/@/g) || []).length;
    if (atCount >= 3) {
        flagged.push(`${atCount} @ symbols (heavy obfuscation)`);
        totalScore += 50;
    } else if (atCount >= 2) {
        flagged.push(`${atCount} @ symbols (domain hiding)`);
        totalScore += 40;
    }

    // 2. Domain-like segments in the URL path
    //    Count occurrences of TLD patterns after the hostname portion
    const TLD_PATTERN = /\.(com|net|org|co\.uk|org\.uk|in\.net|info|biz|me|io|cc|us|uk|de|fr|ru|cn|xyz|top|site|online|club|live|store|app|dev|pro|tech|ltd)\b/gi;
    try {
        const urlObj = new URL(url);
        const pathAndQuery = urlObj.pathname + urlObj.search + urlObj.hash;
        const domainSegments = pathAndQuery.match(TLD_PATTERN) || [];
        if (domainSegments.length >= 5) {
            flagged.push(`${domainSegments.length} domain-like segments in path (redirect chain)`);
            totalScore += 45;
        } else if (domainSegments.length >= 3) {
            flagged.push(`${domainSegments.length} domain-like segments in path`);
            totalScore += 35;
        }
    } catch {
        // If new URL() fails, try raw string matching (the URL might be malformed)
        const domainSegments = url.match(TLD_PATTERN) || [];
        // Subtract 1 for the actual hostname TLD
        const pathSegments = Math.max(0, domainSegments.length - 1);
        if (pathSegments >= 5) {
            flagged.push(`${pathSegments}+ domain-like segments (malformed redirect chain)`);
            totalScore += 45;
        } else if (pathSegments >= 3) {
            flagged.push(`${pathSegments}+ domain-like segments`);
            totalScore += 35;
        }
    }

    // 3. Excessive URL length bonus (common in redirect chains)
    if (url.length > 200 && flagged.length > 0) {
        flagged.push(`Excessive URL length (${url.length} chars)`);
        totalScore += 10;
    }

    const severity = totalScore >= 45 ? 'CRITICAL' : (totalScore >= 30 ? 'HIGH' : 'NONE');

    return {
        title: 'check_redirect_chain',
        description: 'Detects multi-domain redirect chain URLs that abuse @ symbols and embed many domain-like segments to hide the real destination.',
        flagged: flagged.length > 0,
        severity,
        details: flagged.length > 0 ? flagged.join('; ') : 'No redirect chain detected',
        patterns: flagged,
        dataChecked: url,
        score: totalScore
    };
}

