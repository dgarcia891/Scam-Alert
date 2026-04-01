/**
 * AI Second Opinion Verifier (FEAT-088 v2)
 * 
 * Interacts with Google Gemini API to cross-validate local detection signals.
 * Now includes email-specific context (sender, subject, body, links).
 * Returns prompt + raw response for debug transparency.
 */

import { isKnownEmailClient } from '../config/email-clients.js';

const FALLBACK_VERDICT = {
    verdict: 'CONFIRMED',
    reason: 'AI validation inconclusive.',
    details: 'AI validation inconclusive.',
    confidence: 50,
    indicators: []
};

// Architecturally, a timeout is infrastructure failure, NOT security evidence.
// It must never flag a page as a scam.
const TIMEOUT_VERDICT = {
    verdict: 'INCONCLUSIVE',
    reason: 'AI analysis timed out. Check your internet connection and try again.',
    details: 'AI analysis timed out. Check your internet connection and try again.',
    confidence: 0,
    indicators: []
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
 * Handles markdown blocks, leading/trailing junk, and trailing commas.
 * @param {string} rawResponse 
 * @returns {Object} Validated verdict object
 */
export function validateAIResponse(rawResponse) {
    let parsed;
    try {
        // Step 1: Broad cleaning (strip markdown markers)
        let cleaned = rawResponse.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
        
        // Step 2: Extract the JSON object — find the LAST '{' before the last '}'
        // Using lastIndexOf for '}' and searching backward for its matching '{'
        // prevents grabbing stray braces in leading prose (e.g., "Here is the {result}:")
        const lastBrace = cleaned.lastIndexOf('}');
        if (lastBrace !== -1) {
            // Walk backwards from lastBrace to find the opening brace at the same depth
            let depth = 0;
            let firstBrace = -1;
            for (let i = lastBrace; i >= 0; i--) {
                if (cleaned[i] === '}') depth++;
                else if (cleaned[i] === '{') {
                    depth--;
                    if (depth === 0) { firstBrace = i; break; }
                }
            }
            if (firstBrace !== -1) {
                cleaned = cleaned.substring(firstBrace, lastBrace + 1);
            }
        }

        // Step 3: Handle trailing commas (Gemini occasionally returns invalid JSON with them)
        // This simple regex handles trailing commas in objects/arrays before the closing brace
        cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

        parsed = JSON.parse(cleaned);
    } catch (err) {
        console.warn('[AI Verifier] Failed to parse AI response:', err.message);
        return FALLBACK_VERDICT;
    }

    // Schema Validation
    const VALID_VERDICTS = ['CONFIRMED', 'DOWNGRADED', 'ESCALATED'];
    if (!VALID_VERDICTS.includes(parsed.verdict)) {
        console.warn('[AI Verifier] Invalid or missing verdict:', parsed.verdict);
        return FALLBACK_VERDICT;
    }

    const reason = (typeof parsed.reason === 'string' ? parsed.reason.slice(0, 200) : (typeof parsed.details === 'string' ? parsed.details.slice(0, 200) : 'No reason provided.'));

    return {
        verdict: parsed.verdict,
        reason: reason,
        details: reason, // BUG-128 sync: Provide both names to ensure both DevPanel and Main UI work
        confidence: (typeof parsed.confidence === 'number' ? Math.max(0, Math.min(100, parsed.confidence)) : 50),
        indicators: Array.isArray(parsed.indicators) ? parsed.indicators.filter(i => typeof i === 'string').slice(0, 10) : []
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

    if (emailContext.headers && Object.keys(emailContext.headers).length > 0) {
        lines.push(`Hidden HTML Headers / Security Data: ${JSON.stringify(emailContext.headers)}`);
    }

    if (emailContext.isReply !== undefined) {
        lines.push(`Is Reply/Thread: ${emailContext.isReply ? 'Yes' : 'No (unsolicited)'}`);
    }

    lines.push('--- END EMAIL CONTEXT ---');
    return lines.join('\n');
}

/**
 * Helper to extract email context from scan metadata and checks.
 * Used by both background auto-scans and manual 'Ask AI' requests.
 * @param {string} url 
 * @param {Object} meta 
 * @param {Object} emailCheck 
 * @returns {Object|null}
 */
export function extractEmailContext(url, meta = {}, emailCheck = null) {
    const isEmailPage = isKnownEmailClient(url);
    if (!isEmailPage && !meta.subject && !meta.sender && !emailCheck?.flagged) return null;

    let senderName = '';
    let senderEmail = '';
    if (meta.sender) {
        const senderMatch = meta.sender.match(/^(.+?)\s*<(.+?)>$/);
        if (senderMatch) {
            senderName = senderMatch[1].trim();
            senderEmail = senderMatch[2].trim();
        } else if (meta.sender.includes('@')) {
            senderEmail = meta.sender;
        } else {
            senderName = meta.sender;
        }
    }

    const bodyLinks = [];
    if (emailCheck?.visualIndicators) {
        for (const ind of emailCheck.visualIndicators) {
            if (ind.phrase && (ind.phrase.startsWith('http://') || ind.phrase.startsWith('https://'))) {
                bodyLinks.push(ind.phrase);
            }
        }
    }
    if (emailCheck?.evidence?.links) {
        bodyLinks.push(...emailCheck.evidence.links.slice(0, 5));
    }

    const bodySnippet = emailCheck?.evidence?.bodySnippet
        || emailCheck?.evidence?.bodyText
        || meta.bodySnippet
        || '';

    return {
        senderName,
        senderEmail,
        subject: meta.subject || '',
        bodySnippet: typeof bodySnippet === 'string' ? bodySnippet.slice(0, 500) : '',
        bodyLinks: [...new Set(bodyLinks)].slice(0, 5),
        isReply: meta.isReply ?? false
    };
}

/**
 * Call Gemini API to verify a suspicious URL.
 * @param {string} url - The URL to verify
 * @param {Object} details - { signals, phrases, intentKeywords, emailContext, contextType }
 * @param {Object} options - { apiKey }
 * @returns {Object} - { verdict, reason, confidence, _debug: { promptSent, rawResponse } }
 */
export async function verifyWithAI(url, { signals = [], phrases = [], intentKeywords = [], emailContext = null, contextType = 'WEB' }, options = {}) {
    if (!options.apiKey) throw new Error('Gemini API Key missing');

    const hostname = new URL(url).hostname;
    const cleanPhrases = sanitizeForPrompt(phrases);
    const signalCodes = signals.map(s => s.code || s);
    const emailSection = contextType === 'EMAIL' ? buildEmailSection(emailContext) : '';

    const webLogic = `
Contextual logic for REGULAR WEBSITES:
1. If the phrases relate to high-trust brands (Google, Amazon, Banks) but the hostname is unrelated, it's likely a typosquat/scam.
2. If there are "payment failed" or "account expired" lures pointing to non-official domains, it's a critical threat.
3. If the domain uses a suspicious TLD or has unusual port numbers, be more cautious.

Page Text Snippet: ${emailContext?.pageText ? JSON.stringify(emailContext.pageText.slice(0, 500)) : '(None)'}`;

    const emailLogic = `
Contextual logic for EMAILS:
1. If the sender display name does NOT match the sender email address (e.g., name "John" but email "maria@example.pl"), that is a strong scam indicator.
2. If the email body contains URLs with unusual ports (e.g., :8443, :8080) or unfamiliar domains, that is suspicious.
3. If the email is unsolicited (not a reply to a previous thread) and contains links, be more suspicious.
4. If the sender email domain looks like an educational or foreign domain unrelated to the message content, flag it.`;

    const prompt = `You are a phishing and scam classifier integrated into a browser security extension.
Your job is to validate whether the following content is likely a scam or phishing attempt.

Context Type: ${contextType}
URL Hostname: ${hostname}
Detected Phrases/Keywords: ${JSON.stringify(cleanPhrases)}
Detected Intent Category: ${JSON.stringify(intentKeywords)}
Local engine signals: ${JSON.stringify(signalCodes)}
${emailSection}

${contextType === 'EMAIL' ? emailLogic : webLogic}

Respond ONLY with a single valid JSON object. No explanation, no markdown.
If you are unsure, you MUST default verdict to "CONFIRMED" and confidence to 50.
Unknown or missing fields must use their default values.
If you identify any suspicious emails, domains, IPs, or unusual URLs from the context, extract them into the "indicators" array.

Required format:
{
  "verdict": "CONFIRMED" | "DOWNGRADED" | "ESCALATED",
  "reason": "<max 25 words, plain English>",
  "confidence": <integer 0-100>,
  "indicators": ["<suspicious_email>", "<suspicious_domain>"]
}
`;

    const AI_BACKGROUND_TIMEOUT_MS = 15000; // Must be < popup's AI_REQUEST_TIMEOUT_MS (30000ms)

    const controller = new AbortController();
    // Safety net: guaranteed JS-level abort even if AbortSignal.timeout is ignored by browser
    const timeoutHandle = setTimeout(
        () => controller.abort(new Error('AI validation timed out after 15s')),
        AI_BACKGROUND_TIMEOUT_MS
    );

    try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${options.apiKey}`;

        const response = await fetch(endpoint, {
            method: 'POST',
            signal: controller.signal,
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
            // Guard: non-JSON error bodies (e.g., Nginx 503 HTML page) must not throw
            let errMsg = `API error: ${response.status}`;
            try {
                const errBody = await response.json();
                errMsg = errBody.error?.message || errMsg;
            } catch (_) { /* non-JSON body: use status code message */ }
            throw new Error(errMsg);
        }

        const data = await response.json();
        // Remove the starting ```json if the model outputs it
        let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.startsWith('```json')) {
            text = text.replace('```json\n', '');
        }

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
        const isTimeout = err.message?.includes('timed out') || err.name === 'AbortError';
        console.error('[AI Verifier] API call failed:', err.message);

        // Return TIMEOUT_VERDICT for aborts; FALLBACK_VERDICT for unexpected errors
        const baseVerdict = isTimeout ? TIMEOUT_VERDICT : FALLBACK_VERDICT;
        return {
            ...baseVerdict,
            _isTimeout: isTimeout,    // Signal to ai-handler.js: do NOT cache this result
            _debug: {
                promptSent: prompt,
                rawResponse: `(error: ${err.message})`
            }
        };
    } finally {
        // Always clean up — prevents controller memory leak in MV3 SW
        clearTimeout(timeoutHandle);
        controller.abort(); // Safe to call multiple times (no-op if already aborted)
    }
}
