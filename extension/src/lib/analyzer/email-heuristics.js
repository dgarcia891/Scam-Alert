/**
 * Email Heuristic Engine
 * Handles detections specific to email clients like Gmail and Outlook.
 *
 * All keyword lists merge hardcoded defaults with dynamic entries from the
 * database (via getMergedEmailKeywords in database.js).  When no dynamic
 * data is available the hardcoded lists still provide full coverage.
 */
import { getExplanation, INDICATOR_EXPLANATIONS } from './explanations.js';
import { checkSuspiciousPort, checkUrlObfuscation, checkSuspiciousTLD, checkIPAddress, checkRedirectChain } from './url-engine.js';

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
        'buy a', 'buy some', 'purchase a', 'scratch the back', 'photo of the back', 'picture of the back', 'the code', 'reveal the code', 'read the code', 'front and back',
        'pick up', 'amount of each', 'amount owed', 'how many', 'each card', 'i have them',
        'get reimbursed', 'reimbursed', 'pick them up',
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
        'verify your identity', 'verify your account', 'confirm your identity',
        'verification code', 'security code', 'account locked', 'account suspended',
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
    // Extract the email prefix and apex brand (e.g. "github" from "github.com")
    const emailPrefix = sender.split('@')[0] || '';
    const emailDomain = sender.split('@')[1] || '';
    const emailApexBrand = getBaseBrand(emailDomain);
    let mismatchScoreAdded = false;

    if (displayName && emailPrefix && displayName !== emailPrefix) {
        const nameParts = displayName.split(/\s+/).filter(p => p.length > 2);
        if (nameParts.length > 0) {
            const matchesApexDomain = nameParts.some(part => emailApexBrand.includes(part));
            const matchesPrefixOnly = !matchesApexDomain && nameParts.some(part => emailPrefix.includes(part));

            if (matchesPrefixOnly) {
                mismatchScoreAdded = true;
                indicators.push('Brand spoofing detected in email prefix');
                score += 55;
            } else if (!matchesApexDomain) {
                mismatchScoreAdded = true;
                indicators.push('Sender display name does not match email address');
                score += 15; // BUG-150: Reduced from 35. Mismatch alone is common in enterprise
                             // systems (Workday, Jira, Notion). Requires a second indicator to reach HIGH.
            }
        }
    }

    // BUG-161: Intent-Link Mismatch Detection (FEAT-094)
    // The sender's own domain ALWAYS constitutes a legitimate link destination.
    // Extract it once so all checks below can reference it.
    const senderApexDomain = emailDomain ? emailDomain.split('.').slice(-2).join('.') : '';

    const emailSubject = (pageContent.subject || '').toLowerCase();
    const fullText = (emailSubject + ' ' + emailBody);
    const intentKeywords = {
        'google': ['google', 'gmail', 'cloud', 'drive', 'photos', 'storage'],
        'microsoft': ['microsoft', 'outlook', 'office', '365', 'onedrive', 'azure'],
        'apple': ['apple', 'icloud', 'itunes', 'app store', 'mac', 'iphone'],
        'amazon': ['amazon', 'prime', 'aws', 'kindle'],
        'netflix': ['netflix', 'subscription', 'streaming'],
        // BUG-161: 'payment' alone is far too generic — it matches every fintech/bank
        // transactional email. Require more specific banking impersonation keywords.
        'banking': ['bank account', 'wire transfer', 'routing number', 'account number', 'ach transfer']
    };

    // BUG-149: Deduplicate at source. rawUrls is the .href projection of links,
    // so both arrays contain the same URLs. Without Set(), the same URL is checked
    // twice — once in the intent-mismatch loop (section 4) and once in the embedded
    // link URL checks (section 4.5). This also prevents the linkTriggers guard from
    // being invalidated by a second appearance of the same URL with a different object shape.
    const externalLinks = [...new Set([
        ...(pageContent?.links || []).map(l => typeof l === 'string' ? l : l.href || l.url || ''),
        ...(pageContent?.rawUrls || [])
    ].filter(Boolean))].slice(0, 5);

    let mismatchFound = false;
    const detectedBrands = [];
    for (const [brand, keywords] of Object.entries(intentKeywords)) {
        const hasBrandIntent = keywords.some(k => fullText.includes(k));
        if (hasBrandIntent) {
            detectedBrands.push(brand);
            for (const link of externalLinks) {
                try {
                    const hostname = new URL(link).hostname.toLowerCase();
                    // BUG-161: The sender's own apex domain is always legitimate
                    const isSenderDomain = senderApexDomain && hostname.endsWith(senderApexDomain);
                    // If intent is brand but link is NOT brand
                    const isLegit = isBrandLink(hostname, brand);
                    if (!isLegit && !isSenderDomain && !isWhitelistedBrand(hostname)) {
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
    const linkTriggers = {
        port: false,
        obfuscated: false,
        tld: false,
        ip: false,
        redirect: false
    };

    for (const link of externalLinks) {
        if (!linkTriggers.port && checkSuspiciousPort(link).flagged) {
            indicators.push('Suspicious port in embedded link');
            score += 25;
            linkTriggers.port = true;
        }
        if (!linkTriggers.obfuscated && checkUrlObfuscation(link).flagged) {
            indicators.push('Obfuscated embedded link');
            score += 20;
            linkTriggers.obfuscated = true;
        }
        if (!linkTriggers.tld && checkSuspiciousTLD(link).flagged) {
            indicators.push('Suspicious TLD in embedded link');
            score += 20;
            linkTriggers.tld = true;
        }
        if (!linkTriggers.ip && checkIPAddress(link).flagged) {
            indicators.push('IP address used instead of domain in link');
            score += 25;
            linkTriggers.ip = true;
        }
        if (!linkTriggers.redirect) {
            const redirectCheck = checkRedirectChain(link);
            if (redirectCheck.flagged) {
                indicators.push('Multi-domain redirect chain link');
                score += redirectCheck.score;
                linkTriggers.redirect = true;
            }
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

    const keywordMatches = [];
    if (hasGiftCard && hasCommand) {
        keywordMatches.push(...giftCardKeywords.filter(k => emailBody.includes(k)));
        keywordMatches.push(...commandWords.filter(k => emailBody.includes(k)));
    }
    if (hasFinance.length >= 2) {
        keywordMatches.push(...financeKeywords.filter(k => emailBody.includes(k)));
    }
    if (hasVagueLure && hasExternalLinks) {
        keywordMatches.push(...vagueLureKeywords.filter(k => emailBody.includes(k)));
    }
    // Unconditionally add security and critical phrases to keywordMatches 
    // so they are highlighted IF the email gets flagged for ANY reason (e.g. sender spoofing).
    if (hasSecurityLure.length >= 1) {
        keywordMatches.push(...hasSecurityLure);
        
        // Extract individual highlightable words from matched security phrases
        // Gmail fragments text across DOM nodes, so multi-word phrases won't match
        // in the TreeWalker. Individual words will.
        const individualWords = new Set();
        hasSecurityLure.forEach(phrase => {
            phrase.split(/\s+/).forEach(word => {
                if (word.length > 3) individualWords.add(word);
            });
        });
        individualWords.forEach(word => {
            if (emailBody.includes(word) && !keywordMatches.includes(word)) {
                keywordMatches.push(word);
            }
        });
    }

    // Build visualIndicators ONLY when the check is actually flagged.
    const unfilteredIndicators = indicators.length > 0 ? [
        ...indicators.map(label => {
            // For brand spoofing, try to highlight the full sender address if it appears in text
            if (label === 'Brand spoofing detected in email prefix') {
                return { phrase: sender, ...(INDICATOR_EXPLANATIONS[label] || getExplanation(label)) };
            }
            return { phrase: label, ...(INDICATOR_EXPLANATIONS[label] || getExplanation(label)), isMeta: true };
        }),
        ...keywordMatches
            .filter(k => !indicators.some(label =>
                (INDICATOR_EXPLANATIONS[label]?.category || '') ===
                (getExplanation(k)?.category || 'x')
            ))
            .map(phrase => ({ phrase, ...getExplanation(phrase), isMeta: false }))
    ] : [];

    // Filter out literal strings of logical indicator names to prevent wasted TreeWalker cycles in the UI
    const visualIndicators = unfilteredIndicators.filter(i => !i.isMeta);

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
 * Extracts the apex brand string from a complex domain.
 * Supports bypassing common 2-segment TLDs (like .co.uk, .com.au)
 * to prevent subdomain spoofing validation. e.g. github.notreal.com -> "notreal"
 */
function getBaseBrand(emailDomain) {
    if (!emailDomain) return '';
    const parts = emailDomain.toLowerCase().split('.');
    if (parts.length <= 1) return emailDomain;
    
    const tld = parts[parts.length - 1];
    const sld = parts[parts.length - 2];
    
    // Naively handle well-known two-part TLD suffixes
    const ccTlds = ['co', 'org', 'com', 'net', 'edu', 'gov', 'ac'];
    if (ccTlds.includes(sld) && tld.length === 2 && parts.length > 2) {
        return parts[parts.length - 3] || sld; 
    }
    
    return sld;
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
 * Helper: Sites that are common redirectors or high-trust but not brand specific.
 * BUG-161: Expanded to include major social platforms and financial services
 * commonly linked in legitimate marketing and transactional emails.
 */
function isWhitelistedBrand(hostname) {
    const whitelist = [
        // Big tech
        'google.com', 'microsoft.com', 'apple.com', 'amazon.com',
        // Storage/collab
        'dropbox.com', 'box.com',
        // Social platforms — commonly present in email footers (share buttons, social links)
        'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'linkedin.com',
        'youtube.com', 'tiktok.com', 'pinterest.com', 'snapchat.com',
        // Financial / commerce — legitimate transactional email senders
        'paypal.com', 'stripe.com', 'squareup.com', 'shopify.com',
        // Email infrastructure / legal
        'unsubscribe.com', 'list-unsubscribe.com',
        // CDN / email delivery (common in HTML emails)
        'sendgrid.net', 'mailchimp.com', 'klaviyo.com', 'constantcontact.com'
    ];
    return whitelist.some(d => hostname === d || hostname.endsWith('.' + d));
}

