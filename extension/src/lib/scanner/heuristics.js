/**
 * Email Scanner Heuristics (Enhanced)
 * Supports 15+ patterns including gift cards, crypto, urgency, secrecy, authority impersonation.
 */
export function runHeuristics(text, senderInfo = {}) {
    if (!text) return { isScam: false, signals: [], maxScore: 0 };

    const signals = [];
    const lowerText = text.toLowerCase();

    const scamPatterns = [
        // 1-3. Gift Cards
        { regex: /gift card|amazon (card|code)|google play|itunes/i, label: 'Gift Card Request', score: 70 },
        { regex: /scratch the back|photo of the (code|card)|read the numbers/i, label: 'Gift Card Extraction', score: 80 },
        { regex: /ebay card|target card|steam card/i, label: 'Secondary Gift Card Request', score: 65 },

        // 4-6. Crypto & Wire Transfer
        { regex: /wire transfer|routing number|account details/i, label: 'Financial Data Request', score: 60 },
        { regex: /bitcoin|crypto|usdt|eth|wallet address/i, label: 'Cryptocurrency Mention', score: 40 },
        { regex: /send (funds|money) (to|via) (bitcoin|crypto|wire)/i, label: 'Direct Payment Demand', score: 75 },

        // 7-9. Urgency
        { regex: /act immediately|urgent|overdue/i, label: 'High Urgency', score: 30 },
        { regex: /(within|in) (24|48) hours/i, label: 'Time Limit', score: 25 },
        { regex: /account (will be|is) (suspended|locked|deleted|disabled)/i, label: 'Account Threat', score: 45 },

        // 10-12. Secrecy & Pressure
        { regex: /confidential|keep this (between us|secret|quiet)/i, label: 'Secrecy Request', score: 60 },
        { regex: /do not tell anyone|don't tell/i, label: 'Isolation Attempt', score: 70 },
        { regex: /surprise gift|bonus for you/i, label: 'Too Good to be True', score: 35 },

        // 13-15. Authority Impersonation
        { regex: /it (department|desk)|helpdesk|admin/i, label: 'IT Department Impersonation', score: 30 },
        { regex: /ceo|president|management|board of directors/i, label: 'Executive Impersonation', score: 40 },
        { regex: /(geek|bestbuy) squad|paypal|norton|mcafee/i, label: 'Service Impersonation', score: 50 },
        { regex: /kindly/i, label: 'Suspicious Politeness ("Kindly")', score: 15 } // Common in certain scam demographics
    ];

    // Evaluate text against patterns
    scamPatterns.forEach(p => {
        if (p.regex.test(lowerText)) {
            signals.push({ label: p.label, score: p.score });
        }
    });

    // Evaluate sender info for Authority Impersonation mismatches
    if (senderInfo.name && senderInfo.email) {
        const lowerName = senderInfo.name.toLowerCase();
        const lowerEmail = senderInfo.email.toLowerCase();

        // E.g. Name says "Apple Support" but email is "apple@gmail.com"
        if (/(support|admin|security|billing|service)/.test(lowerName) && /(@gmail\.com|@yahoo\.com|@hotmail\.com|@outlook\.com)/.test(lowerEmail)) {
            signals.push({ label: 'Freemail Sender Claiming Authority', score: 65 });
        }

        // Executive impersonation mismatch
        if (/(ceo|founder|director|president)/.test(lowerName) && /(@gmail\.com|@yahoo\.com|@hotmail\.com)/.test(lowerEmail)) {
            signals.push({ label: 'Executive using Freemail', score: 75 });
        }
    }

    // Combination Detection Logic
    const labels = signals.map(s => s.label);

    // Urgency + Financial
    if ((labels.includes('High Urgency') || labels.includes('Account Threat')) &&
        (labels.includes('Financial Data Request') || labels.includes('Direct Payment Demand'))) {
        signals.push({ label: 'COMBINATION: Urgent Financial Threat', score: 85 });
    }

    // Authority + Gift Card
    if ((labels.includes('Executive Impersonation') || labels.includes('IT Department Impersonation')) &&
        (labels.includes('Gift Card Request') || labels.includes('Gift Card Extraction'))) {
        signals.push({ label: 'COMBINATION: CEO Fraud (Gift Cards)', score: 95 });
    }

    // Authority + Secrecy
    if (labels.includes('Executive Impersonation') && (labels.includes('Secrecy Request') || labels.includes('Isolation Attempt'))) {
        signals.push({ label: 'COMBINATION: Secret Executive Request', score: 90 });
    }

    const maxScore = signals.length > 0 ? Math.max(...signals.map(s => s.score)) : 0;

    return {
        isScam: maxScore >= 50 || signals.length > 2, // Threshold logic
        signals: signals,
        maxScore: maxScore
    };
}
