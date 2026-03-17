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
            const body = doc.querySelector(client.selectors.messageBody);
            if (body) bodyText = body.innerText;
        } else if (client.iframeExtraction && doc.body) {
            // Iframe-based clients without a specific body selector: use full iframe body
            const clone = doc.body.cloneNode(true);
            clone.querySelectorAll('script, style').forEach(el => el.remove());
            bodyText = clone.innerText;
        }

        // Extract sender
        if (client.selectors.sender) {
            const senderEl = doc.querySelector(client.selectors.sender);
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
            const subj = doc.querySelector(client.selectors.subject);
            if (subj) subject = subj.innerText;
        }
    } catch (e) {
        console.warn(`[Hydra Guard] ${client.label} extraction failed:`, e);
    }

    return { bodyText, senderName, senderEmail, subject, isEmailView: true };
}
