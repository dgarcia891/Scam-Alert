/**
 * Hydra Hub: Context Detector
 * Identifies page types and extracts specialized metadata.
 */

import { EMAIL_CLIENTS, getMatchingClient } from '../config/email-clients.js';

export const ContextTypes = {
    EMAIL: 'email',
    BANKING: 'banking',
    SOCIAL: 'social',
    SHOPPING: 'shopping',
    GENERIC: 'generic'
};

// Build PROVIDERS lookup from central config for backward compatibility
const PROVIDERS = {};
for (const client of EMAIL_CLIENTS) {
    PROVIDERS[client.id] = {
        pattern: client.urlRegex,
        dom: client.dom || [],
        selectors: {
            sender: client.selectors.sender,
            subject: client.selectors.subject,
            body: client.selectors.messageBody
        }
    };
}

/**
 * Main entry point: Detect page context
 */
export function detectContext() {
    const url = window.location.href;
    const signals = [];
    let type = ContextTypes.GENERIC;
    let provider = null;
    let confidence = 0;

    // 1. Check Email Providers
    for (const [pName, config] of Object.entries(PROVIDERS)) {
        let pScore = 0;
        if (config.pattern.test(url)) {
            pScore += 40;
            signals.push(`URL match: ${pName}`);
        }

        const domMatch = config.dom.some(selector => !!document.querySelector(selector));
        if (domMatch) {
            pScore += 30;
            signals.push(`DOM match: ${pName}`);
        }

        if (pScore >= 40) {
            type = ContextTypes.EMAIL;
            provider = pName;
            confidence = pScore;
            break;
        }
    }

    // 2. Generic Webmail Detection (Fallback)
    if (type === ContextTypes.GENERIC) {
        if (document.querySelectorAll("a[href^='mailto:']").length > 2) {
            confidence += 15;
            signals.push("Multiple mailto links");
        }
        if (document.querySelector("[aria-label*='Compose' i], [aria-label*='New message' i]")) {
            confidence += 20;
            signals.push("Compose button detected");
        }
        if (confidence >= 30) type = ContextTypes.EMAIL;
    }

    return {
        type,
        provider,
        confidence,
        subtype: detectSubtype(type, provider),
        url,
        detectedAt: Date.now(),
        signals
    };
}

/**
 * Detect subtype (Reading, Compose, etc.)
 */
function detectSubtype(type, provider) {
    if (type !== ContextTypes.EMAIL) return null;

    if (document.querySelector("input[type='text'][aria-label*='To' i], [role='textbox'][aria-label*='Body' i]")) {
        return 'compose';
    }

    // If body selector exists and is visible, we are reading
    const config = PROVIDERS[provider];
    if (config && document.querySelector(config.selectors.body)) {
        return 'reading';
    }

    return 'inbox';
}

/**
 * Extract Email Metadata
 */
export function detectEmailMetadata(context) {
    if (context.type !== ContextTypes.EMAIL || !context.provider) return null;

    const config = PROVIDERS[context.provider];
    if (!config) return null;

    const senderEl = document.querySelector(config.selectors.sender);
    const subjectEl = document.querySelector(config.selectors.subject);
    const bodyEl = document.querySelector(config.selectors.body);

    return {
        sender: senderEl ? {
            name: senderEl.textContent?.trim(),
            email: senderEl.getAttribute('email') || senderEl.textContent?.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0]
        } : null,
        subject: subjectEl?.textContent?.trim(),
        bodySnippet: bodyEl?.textContent?.substring(0, 500),
        links: extractLinks(bodyEl),
        extractedAt: Date.now()
    };
}

/**
 * Extract links and score them for suspicion
 */
function extractLinks(container) {
    if (!container) return [];

    return Array.from(container.querySelectorAll('a')).map(a => {
        const text = a.textContent?.trim();
        const href = a.href;
        let score = 0;

        try {
            const url = new URL(href);
            const textDomain = text?.match(/([a-z0-9-]+\.)+[a-z]{2,}/i)?.[0];

            if (textDomain && !url.hostname.includes(textDomain)) {
                score += 40; // Display text mismatch
            }
            if (/^(bit\.ly|t\.co|tinyurl\.com)/.test(url.hostname)) {
                score += 25; // Shortener
            }
            if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(url.hostname)) {
                score += 50; // IP address
            }
        } catch (e) { }

        return { text, href, score, suspicious: score >= 40 };
    });
}
