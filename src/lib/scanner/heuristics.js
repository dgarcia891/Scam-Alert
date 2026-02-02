/**
 * Email Scanner Heuristics (v19.2 Refactored)
 */
export function runHeuristics(text) {
    if (!text) return { isScam: false, signals: [] };

    const signals = [];
    const scamPatterns = [
        { regex: /gift card|google play|itunes/i, label: 'Gift Card Request', score: 50 },
        { regex: /wire transfer|routing number|overdue/i, label: 'Financial Urgency', score: 30 },
        { regex: /scratch the back|photo of the code/i, label: 'Code Extraction', score: 60 }
    ];

    scamPatterns.forEach(p => {
        if (p.regex.test(text)) {
            signals.push({ label: p.label, score: p.score });
        }
    });

    return {
        isScam: signals.length > 0,
        signals,
        maxScore: Math.max(0, ...signals.map(s => s.score))
    };
}
