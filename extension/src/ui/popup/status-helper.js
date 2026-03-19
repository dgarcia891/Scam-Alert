import { isKnownEmailClient } from '../../config/email-clients.js';

/**
 * Derives the UI status state from the underlying scan result.
 */
export function deriveStatusFromResults(res, scanInProgress, currentUrl) {
    if (scanInProgress) return 'loading';
    if (!res) return 'empty';

    // FEAT-119: Override status if AI escalated/confirmed a threat
    if (res.aiVerification && ['ESCALATED', 'CONFIRMED'].includes(res.aiVerification.verdict)) {
        return 'danger';
    }

    if (res.whitelisted) return 'secure';

    // BUG-131: If we are on webmail but have no email content, do NOT return 'secure'.
    // Instead return 'unknown' so the UI shows scanning status and auto-retries.
    const isEmailUrl = isKnownEmailClient(currentUrl);
    const hasContentData = !!(res.metadata?.sender || res.metadata?.subject || res.metadata?.bodySnippet || res.metadata?.body_text);
    
    if (isEmailUrl && !hasContentData) {
        return 'unknown';
    }

    // BUG-SYNC: Align with background isAlert logic
    const severity = res.overallSeverity || res.severity;
    const isThreat = res.overallThreat || ['CRITICAL', 'HIGH'].includes(severity);
    
    if (isThreat) return 'danger';
    if (severity === 'MEDIUM') return 'caution';

    return 'secure';
}
