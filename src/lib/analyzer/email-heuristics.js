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

    // 1. Gift Card Scams
    const giftCardKeywords = ['gift card', 'google play', 'apple card', 'amazon card', 'steam card', 'itunes', 'vanilla visa'];
    const hasGiftCard = giftCardKeywords.some(k => emailBody.includes(k));
    const commandWords = ['buy', 'purchase', 'scratch', 'photo', 'picture', 'code', 'front and back', 'pick up', 'amount', 'how many', 'each card', 'i have them'];
    const hasCommand = commandWords.some(k => emailBody.includes(k));

    if (hasGiftCard && hasCommand) { indicators.push('Gift card payment request'); score += 50; }

    // 2. Sender Inconsistency
    if (displayName && sender) {
        const brandNames = ['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'icloud.com'];
        const isFreeEmail = brandNames.some(b => sender.endsWith(b));
        const officialKeywords = ['official', 'support', 'admin', 'service', 'desk', 'ceo', 'security', 'alert'];
        const isOfficialName = officialKeywords.some(k => displayName.includes(k));
        if (isOfficialName && isFreeEmail) { indicators.push('Official name from personal email address'); score += 40; }
    }

    // 3. Invoice/Wire Fraud
    const financeKeywords = ['invoice', 'wire transfer', 'payment pending', 'unpaid', 'overdue', 'bank details', 'routing number'];
    const hasFinance = financeKeywords.filter(k => emailBody.includes(k));
    if (hasFinance.length >= 2) { indicators.push('Suspicious financial request'); score += 30; }

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
