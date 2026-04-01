/**
 * Email Data Extraction Logic (HG-FEAT-01 Refactored)
 * Uses central email-clients.js config for selector-based parsing.
 */

import { getMatchingClient } from '../../config/email-clients.js';

export async function getEmailSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['settings'], (result) => {
            const settings = result.settings || {};
            resolve({
                enabled: settings.emailScanningEnabled !== false,
                promptDisabled: settings.emailPromptDisabled === true
            });
        });
    });
}

export async function shouldShowPrompt(settings) {
    if (settings.enabled || settings.promptDisabled) return false;
    return new Promise((resolve) => {
        try {
            chrome.storage.local.get(['emailPromptSessionDismissed'], (result) => {
                resolve(!result.emailPromptSessionDismissed);
            });
        } catch {
            resolve(true);
        }
    });
}

/**
 * Helper to extract an email address from free text.
 */
function extractEmail(text) {
    if (!text) return '';
    const match = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
    return match ? match[0] : '';
}

/**
 * Extract sender info based on the client's extraction strategy.
 */
function extractSender(senderEl, client) {
    if (!senderEl) return { name: '', email: '' };

    let name = '';
    let email = '';

    switch (client.senderExtractor) {
        case 'attribute':
            // Gmail-style: getAttribute('name') / getAttribute('email')
            name = senderEl.getAttribute('name') || senderEl.innerText || '';
            email = senderEl.getAttribute('email') || '';
            if (!email) {
                email = extractEmail(name) || extractEmail(senderEl.innerText);
            }
            break;

        case 'aria':
            // Outlook-style: getAttribute('aria-label') / getAttribute('title')
            name = senderEl.getAttribute('aria-label') || senderEl.innerText || '';
            email = senderEl.getAttribute('data-contact-info')
                || senderEl.getAttribute('title')
                || extractEmail(senderEl.innerText) || '';
            break;

        case 'title-attr':
            // Roundcube-style: getAttribute('title') or href mailto:
            name = senderEl.innerText || '';
            email = senderEl.getAttribute('title')
                || senderEl.getAttribute('href')?.replace('mailto:', '')
                || extractEmail(senderEl.innerText) || '';
            break;

        case 'text':
        default:
            // Generic: just use innerText
            name = senderEl.innerText || '';
            email = extractEmail(name) || '';
            break;
    }

    return { name, email };
}

/**
 * Unified email data extraction using the central config.
 */
export function extractEmailData() {
    const url = window.location.href;
    const title = document.title;
    const client = getMatchingClient(url, title);

    let bodyText = '';
    let senderName = '';
    let senderEmail = '';
    let subject = '';

    if (!client) {
        // No matching client found — return empty but signal we tried
        return { bodyText, senderName, senderEmail, subject, isEmailView: false };
    }

    try {
        // Determine the document to query (iframe vs main document)
        let doc = document;
        if (client.iframeExtraction && client.iframeSelector) {
            const iframe = document.querySelector(client.iframeSelector);
            if (iframe) {
                doc = iframe.contentDocument || iframe.contentWindow?.document || document;
            }
        }

        // Extract body text
        if (client.selectors.messageBody) {
            const bodySelectors = client.selectors.messageBody.split(',').map(s => s.trim());
            for (const sel of bodySelectors) {
                const body = doc.querySelector(sel);
                if (body && (body.innerText || '').trim().length > 5) {
                    bodyText = body.innerText.trim();
                    break;
                }
            }
        } else if (client.iframeExtraction && doc.body) {
            // Iframe-based clients without a specific body selector: use full iframe body
            const clone = doc.body.cloneNode(true);
            clone.querySelectorAll('script, style').forEach(el => el.remove());
            bodyText = clone.innerText;
        }

        // Extract sender
        if (client.selectors.sender) {
            const senderEl = document.querySelector(client.selectors.sender) || doc.querySelector(client.selectors.sender);
            if (senderEl) {
                const senderInfo = extractSender(senderEl, client);
                senderName = senderInfo.name;
                senderEmail = senderInfo.email;
            } else if (bodyText) {
                // Fallback: try to find an email pattern in the first 500 chars of body
                const potentialEmail = extractEmail(bodyText.slice(0, 500));
                if (potentialEmail) senderEmail = potentialEmail;
            }
        }

        // Extract subject
        if (client.selectors.subject) {
            const subj = document.querySelector(client.selectors.subject) || doc.querySelector(client.selectors.subject);
            if (subj) subject = subj.innerText;
        }
    } catch (e) {
        console.warn(`[Hydra Guard] ${client.label} extraction failed:`, e);
    }

    return { bodyText, senderName, senderEmail, subject, isEmailView: true };
}

/**
 * Determines if the current page is showing an individual email (reading view),
 * using the client config's readingViewHash and readingViewSelectors.
 *
 * This is INTENTIONALLY separate from extractEmailData() — it must be fast
 * enough to call every 500ms in the SPA navigation interval.
 *
 * @param {object | null} client - from getMatchingClient()
 * @returns {boolean}
 */
export function isEmailReadingViewForClient(client) {
    // Fallback for null client (self-hosted webmail, Roundcube on custom domain):
    // check well-known generic signals that appear in all supported clients.
    if (!client) {
        return !!(
            document.querySelector('#messagecontframe') ||   // Roundcube
            document.querySelector('[data-message-id]')      // Gmail fallback
        );
    }

    // Priority 1: URL hash fast-path (zero DOM, instant)
    if (client.readingViewHash && client.readingViewHash.test(location.hash)) {
        return true;
    }

    // Priority 2: Structural DOM selectors (not body content — attacker-safe)
    if (client.readingViewSelectors?.length > 0) {
        return client.readingViewSelectors.some(sel => !!document.querySelector(sel));
    }

    return false;
}
