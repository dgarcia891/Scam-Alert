/**
 * Phrase and Content Engine
 * Handles linguistic detection and page structure analysis.
 */
import { findBestScamMatch } from './local-matching.js';
import { getExplanation } from './explanations.js';

export function checkSuspiciousKeywords(url, isSuspiciousTLD) {
    const keywords = ['login', 'signin', 'verify', 'update', 'secure', 'account', 'banking', 'suspend', 'locked', 'urgent', 'confirm', 'billing', 'payment', 'wallet', 'alert', 'warning'];
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
    const flagged = found.length >= 3 || (found.length >= 2 && (!url.startsWith('https://') || isSuspiciousTLD));

    let reasonSummary = '';
    if (!flagged && found.length > 0) {
        if (found.length === 1) {
            reasonSummary = 'Only one keyword found. Single keywords are common on normal sites.';
        } else {
            reasonSummary = url.startsWith('https://') && !isSuspiciousTLD
                ? 'Multiple keywords found, but this is HTTPS and uses a normal domain ending.'
                : 'Multiple keywords found, but not enough signals to flag it.';
        }
    }

    const keywordReasons = {};
    found.forEach(k => { keywordReasons[k] = keywordExplanations[k] || 'This keyword can appear in scam URLs.'; });

    return {
        title: 'check_suspicious_keywords',
        description: 'Scans the URL for high-risk words used in phishing attacks.',
        flagged,
        severity: flagged ? 'MEDIUM' : 'NONE',
        details: flagged ? `Suspicious keywords: ${found.join(', ')}` : (found.length > 0 ? `Found keywords: ${found.join(', ')}` : 'No suspicious keywords'),
        keywords: found,
        keywordReasons,
        reasonSummary,
        dataChecked: lowerUrl.substring(0, 5000),
        matches: found,
        score: flagged ? found.length * 5 : 0
    };
}

export function checkUrgencySignals(pageContent, customPhrases = null) {
    const baseUrgency = [
        'immediately', 'suspended', 'unauthorized', 'urgent', 'action required', 'verify now', 'account locked', 'suspicious activity', 'security alert',
        'gift card', 'google play', 'apple card', 'steam card', 'vanilla', 'picture of the back', 'scratch the back', 'scratch and send', 'gift card for me',
        'pick up gift cards', 'amount of each card', 'reveal the code'
    ];
    const urgencyKeywords = customPhrases || baseUrgency;
    const text = ((pageContent?.title || '') + ' ' + (pageContent?.bodyText || '')).toLowerCase();
    const found = urgencyKeywords.filter(k => text.includes(k));

    if (found.length >= 1) {
        return {
            title: 'check_urgency_signals',
            description: 'Scans for high-pressure psychological triggers.',
            flagged: found.length >= 2,
            severity: found.length >= 2 ? 'HIGH' : 'MEDIUM',
            details: found.length >= 2 ? `High urgency language detected: ${found.join(', ')}` : `Suspicious urgency keyword: ${found[0]}`,
            dataChecked: found.join(', '),
            matches: found,
            visualIndicators: found.map(phrase => ({ phrase, ...getExplanation(phrase) })),
            score: found.length >= 2 ? 30 : 15
        };
    }
    return { title: 'check_urgency_signals', flagged: false, score: 0 };
}

export function analyzePageContent(pageContent, customPhrases = null) {
    const { title = '', bodyText = '', forms = [], linkMismatches = [], isHttps = true } = pageContent || {};
    const basePhrases = [
        'you have won', 'claim your prize', 'act now', 'limited time', 'your account has been suspended', 'verify your identity',
        'urgent action required', 'confirm your information', 'click here immediately', 'your computer is infected',
        'call this number now', 'refund pending', 'tax refund', 'purchase a gift card', 'pick up gift cards', 'send me the a picture of the code',
        'do not share this code', 'verify your wallet', 'compromised account', 'legal action', 'final notice', 'money order', 'crypto transfer',
        'scratch the back', 'reveal the code', 'gift card for me', 'amount of each card'
    ];
    const scamPhrases = customPhrases || basePhrases;
    const text = (title + ' ' + bodyText).toLowerCase();
    const foundPhrases = scamPhrases.filter(phrase => text.includes(phrase));
    const sensitiveForms = Array.isArray(forms) ? forms.filter(f => (f.hasPassword || f.hasCreditCard)) : [];
    const insecureForms = !isHttps ? sensitiveForms : [];
    const suspiciousLinks = Array.isArray(linkMismatches) ? linkMismatches.slice(0, 5) : [];

    let score = foundPhrases.length * 10;
    let severity = 'NONE';
    if (foundPhrases.length >= 2) severity = 'HIGH'; else if (foundPhrases.length > 0) severity = 'MEDIUM';

    // Fuzzy matching against all scam phrases (Hydra Guard)
    const fuzzyMatch = findBestScamMatch(title + ' ' + bodyText, scamPhrases, 70);
    if (fuzzyMatch && !foundPhrases.includes(fuzzyMatch.phrase)) {
        score += 25;
        severity = elevateSeverity(severity, 'MEDIUM');
        foundPhrases.push(fuzzyMatch.phrase + ' (Fuzzy Match)');
    }
    if (insecureForms.length > 0) { score += 40; severity = elevateSeverity(severity, 'HIGH'); }
    if (suspiciousLinks.length > 0) { score += 20; severity = elevateSeverity(severity, 'MEDIUM'); }

    return {
        title: 'analyze_page_content',
        description: 'Deeply analyzes the page text and structure.',
        flagged: foundPhrases.length > 0 || insecureForms.length > 0 || suspiciousLinks.length > 0,
        severity, scamPhrases: foundPhrases, hasPasswordInput: sensitiveForms.length > 0, insecureForms, suspiciousLinks,
        details: foundPhrases.length > 0 ? `Urgent wording: ${foundPhrases.join(', ')}` : 'No risky forms or links found.',
        dataChecked: (title + ' ' + bodyText).substring(0, 5000),
        matches: foundPhrases,
        visualIndicators: foundPhrases.map(phrase => ({ phrase, ...getExplanation(phrase) })),
        score
    };
}

function elevateSeverity(current, incoming) {
    const order = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const currentIndex = order.indexOf(current);
    const incomingIndex = order.indexOf(incoming);
    return incomingIndex > currentIndex ? incoming : current;
}
