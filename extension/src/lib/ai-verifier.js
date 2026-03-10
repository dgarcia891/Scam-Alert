/**
 * AI Second Opinion Verifier (FEAT-088 v2)
 * 
 * Interacts with Google Gemini API to cross-validate local detection signals.
 * Now includes email-specific context (sender, subject, body, links).
 * Returns prompt + raw response for debug transparency.
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
 * Sanitize a single string for prompt inclusion.
 * @param {string} text
 * @param {number} maxLen
 * @returns {string}
 */
function sanitizeText(text, maxLen = 200) {
    if (typeof text !== 'string') return '';
    return text.replace(/[^\w\s\-'@.,!?:;()/]/g, '').slice(0, maxLen);
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
 * Build the email-specific block for the prompt.
 * @param {Object} emailContext 
 * @returns {string}
 */
function buildEmailSection(emailContext) {
    if (!emailContext) return '';

    const lines = ['\n--- EMAIL CONTEXT ---'];

    if (emailContext.senderName || emailContext.senderEmail) {
        lines.push(`Sender Display Name: "${sanitizeText(emailContext.senderName, 100)}"`);
        lines.push(`Sender Email Address: "${sanitizeText(emailContext.senderEmail, 100)}"`);
    }

    if (emailContext.subject) {
        lines.push(`Subject Line: "${sanitizeText(emailContext.subject, 150)}"`);
    }

    if (emailContext.bodySnippet) {
        lines.push(`Body Snippet (first 500 chars): "${sanitizeText(emailContext.bodySnippet, 500)}"`);
    }

    if (emailContext.bodyLinks && emailContext.bodyLinks.length > 0) {
        const safeLinks = emailContext.bodyLinks
            .slice(0, 5)
            .map(l => sanitizeText(l, 150));
        lines.push(`URLs found in email body: ${JSON.stringify(safeLinks)}`);
    }

    if (emailContext.isReply !== undefined) {
        lines.push(`Is Reply/Thread: ${emailContext.isReply ? 'Yes' : 'No (unsolicited)'}`);
    }

    lines.push('--- END EMAIL CONTEXT ---');
    return lines.join('\n');
}

/**
 * Call Gemini API to verify a suspicious URL.
 * @param {string} url - The URL to verify
 * @param {Object} details - { signals, phrases, intentKeywords, emailContext }
 * @param {Object} options - { apiKey }
 * @returns {Object} - { verdict, reason, confidence, _debug: { promptSent, rawResponse } }
 */
export async function verifyWithAI(url, { signals = [], phrases = [], intentKeywords = [], emailContext = null }, options = {}) {
    if (!options.apiKey) throw new Error('Gemini API Key missing');

    const hostname = new URL(url).hostname;
    const cleanPhrases = sanitizeForPrompt(phrases);
    const signalCodes = signals.map(s => s.code || s);
    const emailSection = buildEmailSection(emailContext);

    const prompt = `You are a phishing and scam classifier integrated into a browser security extension.
Your job is to validate whether the following content is likely a scam or phishing attempt.

URL Hostname: ${hostname}
Detected Phrases/Keywords: ${JSON.stringify(cleanPhrases)}
Detected Intent Category: ${JSON.stringify(intentKeywords)}
Local engine signals: ${JSON.stringify(signalCodes)}
${emailSection}

Contextual logic:
1. If the phrases relate to high-trust brands (Google, Amazon, Banks) but the hostname is unrelated, it's likely a scam.
2. If there are "payment failed" or "account expired" lures pointing to non-official domains, it's a critical threat.
3. If the sender display name does NOT match the sender email address (e.g., name "John" but email "maria@example.pl"), that is a strong scam indicator.
4. If the email body contains URLs with unusual ports (e.g., :8443, :8080) or unfamiliar domains, that is suspicious.
5. If the email is unsolicited (not a reply to a previous thread) and contains links, be more suspicious.
6. If the sender email domain looks like an educational or foreign domain unrelated to the message content, flag it.

Respond ONLY with a single valid JSON object. No explanation, no markdown.
If you are unsure, you MUST default verdict to "CONFIRMED" and confidence to 50.
Unknown or missing fields must use their default values.

Required format:
{
  "verdict": "CONFIRMED" | "DOWNGRADED" | "ESCALATED",
  "reason": "<max 25 words, plain English>",
  "confidence": <integer 0-100>
}`;

    try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${options.apiKey}`;

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

        if (!text) {
            return { ...FALLBACK_VERDICT, _debug: { promptSent: prompt, rawResponse: '(empty response from API)' } };
        }

        const validated = validateAIResponse(text);
        return {
            ...validated,
            _debug: {
                promptSent: prompt,
                rawResponse: text
            }
        };
    } catch (err) {
        console.error('[AI Verifier] API call failed:', err.message);
        return {
            ...FALLBACK_VERDICT,
            _debug: {
                promptSent: prompt,
                rawResponse: `(error: ${err.message})`
            }
        };
    }
}
