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
        'google': ['google.com', 'gmail.com', 'youtube.com', '.google'],
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

export function checkUrlObfuscation(url) {
    const patterns = {
        excessiveHyphens: /-{3,}/,
        hexEncoding: /%[0-9A-F]{2}/gi,
        dataUri: /^data:/i,
        unusualProtocol: /^(?!https?:\/\/)/i,
        atSymbol: /@/
    };
    const flagged = [];
    let totalScore = 0;

    if (patterns.excessiveHyphens.test(url)) { flagged.push('Excessive hyphens'); totalScore += 15; }
    const hexMatches = url.match(patterns.hexEncoding);
    if (hexMatches && hexMatches.length > 3) { flagged.push('Excessive URL encoding'); totalScore += 20; }
    if (patterns.dataUri.test(url)) { flagged.push('Data URI scheme'); totalScore += 25; }
    if (patterns.atSymbol.test(url)) { flagged.push('@ symbol (potential domain hiding)'); totalScore += 30; }

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
