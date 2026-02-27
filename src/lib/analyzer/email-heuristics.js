/**
 * Email Heuristic Engine
 * Handles detections specific to email clients like Gmail and Outlook.
 */
import { getExplanation, INDICATOR_EXPLANATIONS } from './explanations.js';

export function checkEmailScams(pageContent) {
    if (!pageContent || (!pageContent.isEmailView && !pageContent.emailContext)) {
        return { flagged: false, score: 0 };
    }

    const emailBody = (pageContent.bodyText || '').toLowerCase();
    const sender = (pageContent.senderEmail || '').toLowerCase();
    const displayName = (pageContent.senderName || '').toLowerCase();
    const indicators = [];
    let score = 0;

    // 1. Gift Card Scams — Expanded keyword set
    const giftCardKeywords = ['gift card', 'google play', 'apple card', 'amazon card', 'steam card', 'itunes', 'vanilla visa', 'gift cards'];
    const commandWords = [
        'buy', 'purchase', 'scratch', 'photo', 'picture', 'code', 'front and back',
        'pick up', 'amount', 'how many', 'each card', 'i have them',
        'get reimbursed', 'reimbursed', 'amount of each', 'pick them up',
        'get this done', 'done today', 'get it done',
        'do with them', 'let me know'
    ];
    const hasGiftCard = giftCardKeywords.some(k => emailBody.includes(k));
    const hasCommand = commandWords.some(k => emailBody.includes(k));

    if (hasGiftCard && hasCommand) { indicators.push('Gift card payment request'); score += 50; }

    // 2. Sender Inconsistency: Official title from free email address
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

    // 3. Invoice/Wire Fraud
    const financeKeywords = ['invoice', 'wire transfer', 'payment pending', 'unpaid', 'overdue', 'bank details', 'routing number'];
    const hasFinance = financeKeywords.filter(k => emailBody.includes(k));
    if (hasFinance.length >= 2) { indicators.push('Suspicious financial request'); score += 30; }

    // 4. Authority Impersonation Body Language (Confidence + Urgency Pattern)
    const authorityPressureSignals = [
        'requires discretion', 'cannot take calls', 'cannot receive calls', 'not able to take calls',
        'this should be confidential', 'keep this confidential', 'this is confidential',
        'get this done today', 'done now or later today', 'get it done today',
        'i need your help with something', 'are you in a good space', 'are you available'
    ];
    const authorityFound = authorityPressureSignals.filter(k => emailBody.includes(k));
    if (authorityFound.length >= 1 && (hasGiftCard || indicators.length > 0)) {
        indicators.push('Authority pressure + secrecy language');
        score += 30;
    }

    // 5. Vague Lure Detection: Nostalgia/Photos/Documents + External Link
    // Attackers often use a disarming, friendly lure with an embedded malicious URL.
    // e.g. "I've been meaning to send you these photos" + suspicious link
    const vagueLureKeywords = [
        'nostalgic', 'old photos', 'pictures i wanted to share', 'thought you might enjoy',
        'remember when', 'i found this', 'been meaning to send', 'had to share this',
        'check out this', 'look at this', 'wanted you to see this',
        'voice message', 'voicemail', 'shared a document', 'review this document',
    ];
    const hasVagueLure = vagueLureKeywords.some(k => emailBody.includes(k));
    const hasExternalLinks = pageContent?.links?.length > 0 || pageContent?.rawUrls?.length > 0;

    if (hasVagueLure && hasExternalLinks) {
        indicators.push('Vague social lure with external link');
        score += 35;
    }

    const keywordMatches = [
        ...(giftCardKeywords.filter(k => emailBody.includes(k))),
        ...(commandWords.filter(k => emailBody.includes(k))),
        ...(financeKeywords.filter(k => emailBody.includes(k))),
        ...(vagueLureKeywords.filter(k => emailBody.includes(k)))
    ];

    // Build visualIndicators: prefer high-level narrative labels so the tooltip
    // is as informative as possible, then fall back to raw keyword matches.
    const visualIndicators = [
        // High-level labels (most informative)
        ...indicators.map(label => ({
            phrase: label,
            ...(INDICATOR_EXPLANATIONS[label] || getExplanation(label))
        })),
        // Individual keyword matches that aren't already covered by a label
        ...keywordMatches
            .filter(k => !indicators.some(label =>
                (INDICATOR_EXPLANATIONS[label]?.category || '') ===
                (getExplanation(k)?.category || 'x')
            ))
            .map(phrase => ({ phrase, ...getExplanation(phrase) }))
    ];

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
        score
    };
}

