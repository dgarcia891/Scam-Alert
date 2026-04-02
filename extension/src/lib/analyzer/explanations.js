/**
 * Scam Phrase Explanations
 * Maps detected phrases AND high-level indicator labels to user-friendly
 * "Why" and "What" explanations used by the visual DOM highlighter.
 */

// ─── Phrase-level explanations ───────────────────────────────────────────────
// Keyed on the exact lowercase phrase that appears in the body text.

export const PHRASE_EXPLANATIONS = {
    // ── Fake Prizes ──────────────────────────────────────────────────────────
    'you have won': {
        category: 'Fake Prize',
        reason: 'Scammers use "winning" as bait to get you to hand over personal info or pay a fake "processing fee".'
    },
    'claim your prize': {
        category: 'Fake Prize',
        reason: 'Real prize notifications are never delivered via email links. This is a classic lure.'
    },

    // ── Urgency Tactics ───────────────────────────────────────────────────────
    'act now': {
        category: 'Urgency',
        reason: 'Designed to make you act before you have time to think or verify.'
    },
    'limited time': {
        category: 'Urgency',
        reason: 'Artificial scarcity is a textbook psychological trick to bypass critical thinking.'
    },
    'urgent action required': {
        category: 'Urgency',
        reason: 'High-pressure phrasing engineered to induce panic and hasty decisions.'
    },
    'click here immediately': {
        category: 'Urgency',
        reason: 'Urgency + a vague call-to-action is a hallmark of phishing attacks.'
    },
    'immediately': {
        category: 'Urgency',
        reason: 'Urgency language used to prevent you from pausing and thinking critically.'
    },
    'action required': {
        category: 'Urgency',
        reason: 'Commonly used in phishing emails to create a false sense of obligation.'
    },
    'verify now': {
        category: 'Urgency',
        reason: 'Pairing urgency with a verification request is a classic credential-theft tactic.'
    },

    // ── Account Takeover / Fear ───────────────────────────────────────────────
    'your account has been suspended': {
        category: 'Fear Tactic',
        reason: 'Fear of losing access is used to trick you into entering your credentials on a fake site.'
    },
    'account locked': {
        category: 'Fear Tactic',
        reason: '"Account locked" scares are engineered to push you to a fake login page immediately.'
    },
    'suspicious activity': {
        category: 'Account Takeover',
        reason: 'Fake security alerts are the #1 method scammers use to steal login passwords.'
    },
    'security alert': {
        category: 'Account Takeover',
        reason: 'Used to create alarm and push you toward a spoofed "secure" login page.'
    },
    'unauthorized': {
        category: 'Account Takeover',
        reason: '"Unauthorized access" scares are used to trigger panic and hasty log-ins.'
    },
    'suspended': {
        category: 'Fear Tactic',
        reason: 'A suspended account is an emotional trigger frequently exploited in phishing.'
    },

    // ── Phishing ──────────────────────────────────────────────────────────────
    'verify your identity': {
        category: 'Phishing',
        reason: 'A broad "identity verification" request is often cover for stealing your SSN or government ID.'
    },
    'confirm your information': {
        category: 'Phishing',
        reason: 'Legitimate services never ask you to "confirm" credentials via an unsolicited link.'
    },
    'verify your wallet': {
        category: 'Phishing',
        reason: 'Crypto wallet "verification" requests almost exclusively lead to theft.'
    },
    'compromised account': {
        category: 'Phishing',
        reason: 'Another emotional trigger used to rush you into clicking a malicious link.'
    },

    // ── Tech Support Scams ────────────────────────────────────────────────────
    'your computer is infected': {
        category: 'Tech Support Scam',
        reason: 'Websites cannot detect viruses on your computer. This claim is always false and always a scam.'
    },
    'call this number now': {
        category: 'Tech Support Scam',
        reason: 'Scammers set up fake call centers to walk victims through granting remote computer access.'
    },

    // ── Financial Scams ───────────────────────────────────────────────────────
    'refund pending': {
        category: 'Financial Scam',
        reason: '"Surprise" refunds lead to requests for you to "pay a fee first" or share your bank login.'
    },
    'tax refund': {
        category: 'Financial Scam',
        reason: 'Government agencies (IRS, HMRC) never notify you of refunds via email or text links.'
    },
    'final notice': {
        category: 'Financial Scam',
        reason: 'Fake "final notices" use deadline pressure to extract payments or personal data.'
    },
    'legal action': {
        category: 'Financial Scam',
        reason: 'Threat of legal action is a scare tactic used to force immediate payment.'
    },
    'money order': {
        category: 'Financial Scam',
        reason: 'Money orders are preferred by scammers because they are irreversible once sent.'
    },
    'crypto transfer': {
        category: 'Financial Scam',
        reason: 'Irreversible cryptocurrency transfers are the payment method of choice for scammers.'
    },
    'wire transfer': {
        category: 'Financial Scam',
        reason: 'Like crypto, wire transfers are near-impossible to reverse — a scammer favourite.'
    },
    'invoice': {
        category: 'Financial Scam',
        reason: 'Fake invoice scams target businesses by sending fraudulent payment requests.'
    },
    'payment pending': {
        category: 'Financial Scam',
        reason: '"Pending payment" creates urgency and a false obligation to act.'
    },
    'bank details': {
        category: 'Financial Scam',
        reason: 'Requests for bank details via email are a major red flag for account fraud.'
    },
    'routing number': {
        category: 'Financial Scam',
        reason: 'Your routing number combined with an account number gives full access to wire funds.'
    },

    // ── Gift Card Scams ───────────────────────────────────────────────────────
    'purchase a gift card': {
        category: 'Gift Card Scam',
        reason: 'Gift cards are not a form of payment. Anyone demanding gift card payment is a scammer.'
    },
    'pick up gift cards': {
        category: 'Gift Card Scam',
        reason: 'Being directed to a store to buy cards physically is a hallmark of organized scam rings.'
    },
    'gift card for me': {
        category: 'Gift Card Scam',
        reason: 'Scammers impersonate bosses, clergy, or family asking for a "quick favor" involving cards.'
    },
    'gift card': {
        category: 'Gift Card Scam',
        reason: 'No legitimate authority (government, tech support, boss) will ever pay or be paid in gift cards.'
    },
    'gift cards': {
        category: 'Gift Card Scam',
        reason: 'No legitimate authority (government, tech support, boss) will ever pay or be paid in gift cards.'
    },
    'scratch the back': {
        category: 'Gift Card Scam',
        reason: 'Asking you to scratch the PIN area is asking you to reveal the funds — the scam\'s entire goal.'
    },
    'reveal the code': {
        category: 'Gift Card Scam',
        reason: 'Once you share the code, the money is immediately and permanently gone.'
    },
    'amount of each card': {
        category: 'Gift Card Scam',
        reason: 'Scripted language used in organised gift card theft operations.'
    },
    'do not share this code': {
        category: 'Gift Card Scam',
        reason: 'Paradoxically, the scammer says "don\'t share" but is setting you up to share with them.'
    },

    // ── Vague Social Lures ────────────────────────────────────────────────────
    'nostalgic': {
        category: 'Social Lure',
        reason: 'Emotional nostalgia lures are used to make you click a malicious link without suspicion.'
    },
    'old photos': {
        category: 'Social Lure',
        reason: 'Promises of old photos are a disarming cover for delivering malware links.'
    },
    'been meaning to send': {
        category: 'Social Lure',
        reason: 'Casual, friendly phrasing is used to lower your guard before presenting a malicious link.'
    },
    'voice message': {
        category: 'Social Lure',
        reason: 'Fake voicemail links are a very common phishing vector — they typically install malware.'
    },
    'voicemail': {
        category: 'Social Lure',
        reason: 'Fake voicemail links are a very common phishing vector — they typically install malware.'
    },
    'shared a document': {
        category: 'Social Lure',
        reason: 'Fake shared document links (mimicking Google Docs/Drive) are a top phishing technique.'
    },
    'review this document': {
        category: 'Social Lure',
        reason: 'Fake document review requests are widely used to steal login credentials.'
    },

    // ── Account Security / Authenticator Lure ─────────────────────────────────
    'verify your identity': {
        category: 'Account Security Lure',
        reason: 'Legitimate services rarely ask you to "verify your identity" via email. This phrasing is commonly used in phishing to steal login credentials.'
    },
    'verify your account': {
        category: 'Account Security Lure',
        reason: 'Requests to "verify your account" via email are a hallmark of credential phishing. Real companies use in-app verification flows.'
    },
    'confirm your identity': {
        category: 'Account Security Lure', 
        reason: 'Identity confirmation requests via email are typically phishing attempts designed to harvest personal information.'
    },
    'verification code': {
        category: 'Account Security Lure',
        reason: 'While real services send verification codes, scammers impersonate them to intercept or phish for these codes.'
    },
    'account locked': {
        category: 'Account Security Lure',
        reason: '"Account locked" notifications are a common phishing pressure tactic designed to make you click urgently.'
    },
    'account suspended': {
        category: 'Account Security Lure',
        reason: '"Account suspended" alerts create panic — scammers use this fear to drive you to fake login pages.'
    },

    // Extracted individual words for Highlighting (Context-aware tooltips)
    'verify': {
        category: 'Account Security Detail',
        reason: 'Flagged because it appears alongside other security-related language in this email — a pattern consistent with credential phishing.'
    },
    'identity': {
        category: 'Account Security Detail',
        reason: 'Flagged because it appears alongside other security-related language in this email — a pattern consistent with credential phishing.'
    },
    'account': {
        category: 'Account Security Detail',
        reason: 'Flagged because it appears alongside other security-related language in this email — a pattern consistent with credential phishing.'
    },
    'verification': {
        category: 'Account Security Detail',
        reason: 'Flagged because it appears alongside other security-related language in this email — a pattern consistent with credential phishing.'
    },
    'locked': {
        category: 'Account Security Detail',
        reason: 'Flagged because it appears alongside other security-related language in this email — a pattern consistent with credential phishing.'
    },
    'suspended': {
        category: 'Account Security Detail',
        reason: 'Flagged because it appears alongside other security-related language in this email — a pattern consistent with credential phishing.'
    }
};

// ─── High-level indicator explanations ───────────────────────────────────────
// Keyed on the narrative label used by the email & URL heuristics engines.
// These are used when we want to explain a *category* rather than a single phrase.

export const INDICATOR_EXPLANATIONS = {
    'Gift card payment request': {
        category: 'Gift Card Scam',
        reason: 'Multiple gift card signals detected. Any request involving gift card "payment" is a scam — every time.'
    },
    'Official name from personal email address': {
        category: 'Impersonation',
        reason: 'This email claims to be from an official or authority figure but was sent from a free personal account — a classic impersonation tactic.'
    },
    'Brand spoofing detected in email prefix': {
        category: 'Sender Spoofing',
        reason: 'The sender\'s email address hides a well-known brand name in the prefix (before the @) while using a completely different domain. This is a deliberate spoofing tactic — the real sender is NOT affiliated with the brand they are impersonating.'
    },
    'Sender display name does not match email address': {
        category: 'Impersonation',
        reason: 'The sender\'s actual email address does not match the company or person they claim to be in their display name.'
    },
    'Suspicious financial request': {
        category: 'Financial Fraud',
        reason: 'Multiple financial keywords detected. This pattern is consistent with invoice fraud and business email compromise (BEC).'
    },
    'Authority pressure + secrecy language': {
        category: 'Manipulation',
        reason: 'Combining authority ("I need this done") with secrecy ("keep this confidential") is a manipulation pattern used to prevent you from verifying the request.'
    },
    'Vague social lure with external link': {
        category: 'Social Engineering',
        reason: 'A disarming, friendly message paired with an external link is a delivery mechanism for phishing and malware.'
    },
    'Multi-domain redirect chain link': {
        category: 'Link Obfuscation',
        reason: 'This link contains multiple @ symbols and chained domain segments designed to hide the real destination — a strong phishing signal.'
    },
    'Account security or payment lure': {
        category: 'Account Security Lure',
        reason: 'This email contains multiple account-security phrases typically used in phishing attacks to pressure you into revealing credentials or payment information.'
    }
};

/**
 * Get an explanation for a detected phrase or indicator label.
 * Handles fuzzy-match annotations gracefully.
 * @param {string} phrase
 * @returns {{ category: string, reason: string }}
 */
export function getExplanation(phrase) {
    const normalized = phrase.toLowerCase().replace(/\s*\(fuzzy\s+match\)/i, '').trim();
    return (
        PHRASE_EXPLANATIONS[normalized] ||
        INDICATOR_EXPLANATIONS[normalized] ||
        {
            category: 'Suspicious Pattern',
            reason: 'This phrase or pattern is commonly associated with scam and phishing campaigns.'
        }
    );
}
