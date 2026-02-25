/**
 * Email Heuristic Engine
 * Handles detections specific to email clients like Gmail and Outlook.
 */

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

    // Check direct sender OR forwarded block sender in body
    const isFreeEmail = sender ? freeEmailProviders.some(b => sender.endsWith(b)) : freeEmailProviders.some(b => emailBody.includes(b));
    const isOfficialName = officialKeywords.some(k => displayName.includes(k) || emailBody.includes(`from: ${k}`) || emailBody.includes(`to: ${k}`) || (emailBody.includes(k) && emailBody.includes('request')));

    if (isOfficialName && isFreeEmail) {
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

    return {
        title: 'check_email_scams',
        description: 'Specific scanner for common email frauds like gift card and invoice scams.',
        flagged: indicators.length > 0,
        severity: score >= 50 ? 'CRITICAL' : (score >= 30 ? 'HIGH' : 'NONE'),
        details: indicators.length > 0 ? `Email scam indicators: ${indicators.join(', ')}` : 'No email-specific scams detected',
        indicators,
        dataChecked: Math.max(emailBody.length, 1) > 1 ? emailBody.substring(0, 5000) : `Sender: ${sender}`,
        matches: [...(giftCardKeywords.filter(k => emailBody.includes(k))), ...(commandWords.filter(k => emailBody.includes(k))), ...(financeKeywords.filter(k => emailBody.includes(k)))],
        score
    };
}

