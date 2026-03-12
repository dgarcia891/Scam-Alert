/**
 * Email Heuristic Engine
 * Handles detections specific to email clients like Gmail and Outlook.
 *
 * All keyword lists merge hardcoded defaults with dynamic entries from the
 * database (via getMergedEmailKeywords in database.js).  When no dynamic
 * data is available the hardcoded lists still provide full coverage.
 */
import { getExplanation, INDICATOR_EXPLANATIONS } from './explanations.js';
import { checkSuspiciousPort, checkUrlObfuscation, checkSuspiciousTLD, checkIPAddress } from './url-engine.js';

/**
 * @param {Object} pageContent        — extracted email data (bodyText, senderEmail, links, etc.)
 * @param {Object|null} dynamicEmailKeywords — category-keyed keyword arrays from database.js
 */
export function checkEmailScams(pageContent, dynamicEmailKeywords = null) {
    if (!pageContent || (!pageContent.isEmailView && !pageContent.emailContext)) {
        return { flagged: false, score: 0 };
    }

    const dyn = dynamicEmailKeywords || {};
    const emailBody = (pageContent.bodyText || '').toLowerCase();
    const sender = (pageContent.senderEmail || '').toLowerCase();
    const displayName = (pageContent.senderName || '').toLowerCase();
    const indicators = [];
    let score = 0;

    // 1. Gift Card Scams — Expanded keyword set (hardcoded + dynamic)
    const giftCardKeywords = [...new Set([
        'gift card', 'google play', 'apple card', 'amazon card', 'steam card', 'itunes', 'vanilla visa', 'gift cards',
        ...(dyn.giftCardKeywords || [])
    ])];
    const commandWords = [...new Set([
        'buy', 'purchase', 'scratch', 'photo', 'picture', 'code', 'front and back',
        'pick up', 'amount', 'how many', 'each card', 'i have them',
        'get reimbursed', 'reimbursed', 'amount of each', 'pick them up',
        'get this done', 'done today', 'get it done',
        'do with them', 'let me know',
        ...(dyn.commandWords || [])
    ])];
    const hasGiftCard = giftCardKeywords.some(k => emailBody.includes(k));
    const hasCommand = commandWords.some(k => emailBody.includes(k));

    if (hasGiftCard && hasCommand) { indicators.push('Gift card payment request'); score += 50; }

    // 2. Account Security & Payment Lures (NEW)
    const securityKeywords = [...new Set([
        'failed', 'expired', 'renew', 'subscription', 'storage', 'update payment',
        'card declined', 'transaction failed', 'action required', 'unauthorized',
        ...(dyn.securityKeywords || [])
    ])];
    const hasSecurityLure = securityKeywords.filter(k => emailBody.includes(k));
    if (hasSecurityLure.length >= 2) {
        indicators.push('Account security or payment lure');
        score += 30;
    }

    // 3. Sender Inconsistency: Official title from free email address
    const freeEmailProviders = ['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'icloud.com', 'aol.com', 'protonmail.com'];
    const officialKeywords = [
        'official', 'support', 'admin', 'service', 'desk', 'ceo', 'security', 'alert',
        'father', 'pastor', 'priest', 'bishop', 'reverend', 'deacon', 'minister',
        'director', 'president', 'principal', 'superintendent', 'manager', 'hr'
    ];

    let senderFound = false;

    // A. Check direct sender
    if (displayName && sender) {
        const isFreeEmail = freeEmailProviders.some(b => sender.endsWith(b));
        const isOfficialName = officialKeywords.some(k => displayName.includes(k));
        if (isOfficialName && isFreeEmail) { senderFound = true; }
    }

    // B. Check forwarded blocks in body (more robust than generic include)
    // Looking for patterns like "From: Father Ivan <scammer@gmail.com>"
    if (!senderFound) {
        // Regex to find "From: [Name] <[Email]>" or "From: [Email]" or "[Name] [Email]" blocks
        const fromLines = emailBody.match(/(?:from|sent by):\s*([^<>\n]+)(?:<([^<>\n]+)>)?/gi) || [];
        for (const line of fromLines) {
            const hasOfficial = officialKeywords.some(k => line.includes(k));
            const hasFreeProvider = freeEmailProviders.some(b => line.includes(b));
            if (hasOfficial && hasFreeProvider) {
                senderFound = true;
                break;
            }
        }
    }

    if (senderFound) {
        indicators.push('Official name from personal email address');
        score += 40;
    }

    // 3.5 Display Name / Email Mismatch Check (NEW)
    // Extract the email prefix (e.g., marek.bartis022 from marek.bartis022@skolavdf.cz)
    const emailPrefix = sender.split('@')[0];
    let mismatchScoreAdded = false;

    if (displayName && emailPrefix && displayName !== emailPrefix) {
        const nameParts = displayName.split(/\s+/).filter(p => p.length > 2);
        if (nameParts.length > 0) {
            // Check if ANY part of the display name is in the email prefix
            const hasOverlap = nameParts.some(part => emailPrefix.includes(part));
            if (!hasOverlap) {
                mismatchScoreAdded = true;
                indicators.push('Sender display name does not match email address');
                score += 35; 
            }
        }
    }

    // 4. Intent-Link Mismatch Detection (FEAT-094)
    const emailSubject = (pageContent.subject || '').toLowerCase();
    const fullText = (emailSubject + ' ' + emailBody);
    const intentKeywords = {
        'google': ['google', 'gmail', 'cloud', 'drive', 'photos', 'storage'],
        'microsoft': ['microsoft', 'outlook', 'office', '365', 'onedrive', 'azure'],
        'apple': ['apple', 'icloud', 'itunes', 'app store', 'mac', 'iphone'],
        'amazon': ['amazon', 'prime', 'aws', 'kindle'],
        'netflix': ['netflix', 'subscription', 'streaming'],
        'banking': ['bank', 'chase', 'wellsfargo', 'bofa', 'capital one', 'visa', 'mastercard', 'payment']
    };

    const externalLinks = [
        ...(pageContent?.links || []).map(l => typeof l === 'string' ? l : l.href || l.url || ''),
        ...(pageContent?.rawUrls || [])
    ].filter(Boolean).slice(0, 5);

    let mismatchFound = false;
    const detectedBrands = [];
    for (const [brand, keywords] of Object.entries(intentKeywords)) {
        const hasBrandIntent = keywords.some(k => fullText.includes(k));
        if (hasBrandIntent) {
            detectedBrands.push(brand);
            for (const link of externalLinks) {
                try {
                    const hostname = new URL(link).hostname.toLowerCase();
                    // If intent is brand but link is NOT brand
                    const isLegit = isBrandLink(hostname, brand);
                    if (!isLegit && !isWhitelistedBrand(hostname)) {
                        mismatchFound = true;
                        break;
                    }
                } catch (e) { }
            }
        }
    }

    if (mismatchFound) {
        indicators.push('Intent-link mismatch: suspicious destination');
        score += 50;
    }

    // 4.5 Embedded Link URL Checks (NEW)
    for (const link of externalLinks) {
        if (checkSuspiciousPort(link).flagged) {
            indicators.push('Suspicious port in embedded link');
            score += 25;
        }
        if (checkUrlObfuscation(link).flagged) {
            indicators.push('Obfuscated embedded link');
            score += 20;
        }
        if (checkSuspiciousTLD(link).flagged) {
            indicators.push('Suspicious TLD in embedded link');
            score += 20;
        }
        if (checkIPAddress(link).flagged) {
            indicators.push('IP address used instead of domain in link');
            score += 25;
        }
    }

    // 5. Invoice/Wire Fraud (hardcoded + dynamic)
    const financeKeywords = [...new Set([
        'invoice', 'wire transfer', 'payment pending', 'unpaid', 'overdue', 'bank details', 'routing number',
        ...(dyn.financeKeywords || [])
    ])];
    const hasFinance = financeKeywords.filter(k => emailBody.includes(k));
    if (hasFinance.length >= 2) { indicators.push('Suspicious financial request'); score += 30; }

    // 6. Authority Impersonation Body Language (hardcoded + dynamic)
    const authorityPressureSignals = [...new Set([
        'requires discretion', 'cannot take calls', 'cannot receive calls', 'not able to take calls',
        'this should be confidential', 'keep this confidential', 'this is confidential',
        'get this done today', 'done now or later today', 'get it done today',
        'i need your help with something', 'are you in a good space', 'are you available',
        ...(dyn.authorityPressureSignals || [])
    ])];
    const authorityFound = authorityPressureSignals.filter(k => emailBody.includes(k));
    if (authorityFound.length >= 1 && (hasGiftCard || indicators.length > 0)) {
        indicators.push('Authority pressure + secrecy language');
        score += 30;
    }

    // 7. Vague Lure Detection: Nostalgia/Photos/Documents + External Link
    const vagueLureKeywords = [...new Set([
        'nostalgic', 'old photos', 'pictures i wanted to share', 'thought you might enjoy',
        'remember when', 'i found this', 'been meaning to send', 'had to share this',
        'check out this', 'look at this', 'wanted you to see this',
        'voice message', 'voicemail', 'shared a document', 'review this document',
        'those pics', 'those pictures', 'remember them', 'open this', 'photos',
        ...(dyn.vagueLureKeywords || [])
    ])];
    const matchedLureKeywords = vagueLureKeywords.filter(k => emailBody.includes(k));
    const hasVagueLure = matchedLureKeywords.length > 0;
    const hasExternalLinks = externalLinks.length > 0;

    if (hasVagueLure && hasExternalLinks) {
        indicators.push('Vague social lure with external link');
        score += 35;
    }

    const keywordMatches = [
        ...(giftCardKeywords.filter(k => emailBody.includes(k))),
        ...(commandWords.filter(k => emailBody.includes(k))),
        ...(financeKeywords.filter(k => emailBody.includes(k))),
        ...(vagueLureKeywords.filter(k => emailBody.includes(k))),
        ...(securityKeywords.filter(k => emailBody.includes(k)))
    ];

    // Build visualIndicators ONLY when the check is actually flagged.
    const visualIndicators = indicators.length > 0 ? [
        ...indicators.map(label => ({
            phrase: label,
            ...(INDICATOR_EXPLANATIONS[label] || getExplanation(label))
        })),
        ...keywordMatches
            .filter(k => !indicators.some(label =>
                (INDICATOR_EXPLANATIONS[label]?.category || '') ===
                (getExplanation(k)?.category || 'x')
            ))
            .map(phrase => ({ phrase, ...getExplanation(phrase) }))
    ] : [];

    return {
        title: 'check_email_scams',
        description: 'Specific scanner for common email frauds like gift card and invoice scams.',
        flagged: indicators.length > 0,
        severity: score >= 50 ? 'CRITICAL' : (score >= 30 ? 'HIGH' : 'NONE'),
        details: indicators.length > 0 ? `Email scam indicators: ${indicators.join(', ')}` : 'No email-specific scams detected',
        indicators: indicators,
        visualIndicators,
        dataChecked: Math.max(emailBody.length, 1) > 1 ? emailBody.substring(0, 5000) : `Sender: ${sender}`,
        matches: keywordMatches,
        evidence: {
            lureKeywords: matchedLureKeywords,
            externalLinks: externalLinks,
            giftCardKeywordsFound: giftCardKeywords.filter(k => emailBody.includes(k)),
            commandWordsFound: commandWords.filter(k => emailBody.includes(k)),
            financeKeywordsFound: financeKeywords.filter(k => emailBody.includes(k)),
            securityKeywordsFound: hasSecurityLure,
            authoritySignalsFound: authorityFound || [],
            senderMismatch: senderFound ? { displayName, sender } : null,
            generalizedSenderMismatch: mismatchScoreAdded,
            intentMismatch: mismatchFound,
            detectedBrands: detectedBrands
        },
        score
    };
}

/**
 * Helper: Check if hostname belongs to the branded intent (simplified)
 */
function isBrandLink(hostname, brand) {
    const brandDomains = {
        'google': ['google.com', 'gmail.com', 'gstatic.com', 'googleusercontent.com'],
        'microsoft': ['microsoft.com', 'live.com', 'outlook.com', 'office.com', 'office365.com'],
        'apple': ['apple.com', 'icloud.com', 'me.com'],
        'amazon': ['amazon.com', 'aws.amazon.com', 'media-amazon.com'],
        'netflix': ['netflix.com'],
        'banking': [] // Generic banking is hard to verify without a whitelist
    };
    const domains = brandDomains[brand] || [];
    return domains.some(d => hostname === d || hostname.endsWith('.' + d));
}

/**
 * Helper: Sites that are common redirectors or high-trust but not brand specific
 */
function isWhitelistedBrand(hostname) {
    const whitelist = ['google.com', 'microsoft.com', 'apple.com', 'amazon.com', 'dropbox.com', 'box.com'];
    return whitelist.some(d => hostname === d || hostname.endsWith('.' + d));
}

