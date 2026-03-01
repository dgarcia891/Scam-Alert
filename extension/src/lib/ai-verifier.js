/**
 * AI Second Opinion Verifier (FEAT-088)
 * 
 * Interacts with Google Gemini API to cross-validate local detection signals.
 * Includes strict schema validation and adversarial input sanitization.
 */

const FALLBACK_VERDICT = {
    verdict: 'CONFIRMED',
    reason: 'AI validation inconclusive.',
    confidence: 50
};

/**
 * Sanitize phrases to prevent prompt injection and keep context tight.
 * @param {string[]} phrases 
 * @returns {string[]}
 */
export function sanitizeForPrompt(phrases) {
    if (!Array.isArray(phrases)) return [];
    return phrases
        .filter(p => typeof p === 'string')
        .map(p => p.replace(/[^\w\s\-']/g, '').slice(0, 60)) // Alphanumeric + basic chars, 60 chars max
        .slice(0, 10); // Cap at 10 phrases
}

/**
 * Validate and sanitize the AI's JSON response.
 * @param {string} rawResponse 
 * @returns {Object} Validated verdict object
 */
export function validateAIResponse(rawResponse) {
    let parsed;
    try {
        // Strip potential markdown code blocks if the model included them
        const cleaned = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
    } catch (err) {
        console.warn('[AI Verifier] Failed to parse AI response:', err);
        return FALLBACK_VERDICT;
    }

    // Schema Validation
    const VALID_VERDICTS = ['CONFIRMED', 'DOWNGRADED', 'ESCALATED'];
    if (!VALID_VERDICTS.includes(parsed.verdict)) return FALLBACK_VERDICT;

    return {
        verdict: parsed.verdict,
        reason: (typeof parsed.reason === 'string' ? parsed.reason.slice(0, 200) : 'No reason provided.'),
        confidence: (typeof parsed.confidence === 'number' ? Math.max(0, Math.min(100, parsed.confidence)) : 50)
    };
}

/**
 * Call Gemini API to verify a suspicious URL.
 * @param {string} url - The URL to verify
 * @param {Object} details - { signals, phrases }
 * @param {Object} options - { apiKey }
 */
export async function verifyWithAI(url, { signals = [], phrases = [] }, options = {}) {
    if (!options.apiKey) throw new Error('Gemini API Key missing');

    const hostname = new URL(url).hostname;
    const cleanPhrases = sanitizeForPrompt(phrases);
    const signalCodes = signals.map(s => s.code || s);

    const prompt = `You are a phishing URL classifier integrated into a browser security extension.
Your ONLY job is to validate whether the following URL is likely a scam.

URL Hostname: ${hostname}
Local engine signals: ${JSON.stringify(signalCodes)}
Detected phrases: ${JSON.stringify(cleanPhrases)}

Respond ONLY with a single valid JSON object. No explanation, no markdown.
If you are unsure, you MUST default verdict to "CONFIRMED" and confidence to 50.
Unknown or missing fields must use their default values.

Required format:
{
  "verdict": "CONFIRMED" | "DOWNGRADED" | "ESCALATED",
  "reason": "<max 15 words, plain English>",
  "confidence": <integer 0-100>
}`;

    try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${options.apiKey}`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1, // High determinism
                    topP: 0.95,
                    topK: 64,
                    maxOutputTokens: 200,
                    responseMimeType: "application/json"
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `API error: ${response.status}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) return FALLBACK_VERDICT;

        return validateAIResponse(text);
    } catch (err) {
        console.error('[AI Verifier] API call failed:', err.message);
        return FALLBACK_VERDICT;
    }
}
