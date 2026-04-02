/**
 * Email Data Extraction Logic (HG-FEAT-01 Refactored)
 * Uses central email-clients.js config for selector-based parsing.
 */

import { extractEmailText, parseSenderInfo, extractSubject } from '../../lib/scanner/parser.js';
import { getMatchingClient } from '../../config/email-clients.js';

// Gmail UI chrome prefixes that indicate parser.js Tier 2/3 scraped the sidebar/nav
// rather than the email body. These are used to reject false-positive fallback results
// on image-only emails. (BUG-146 M-1)
const UI_NOISE_PREFIXES = ['Compose', 'Primary', 'Social', 'Promotions', 'Inbox', 'Starred'];

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
 * Falls back to parser.js for robust adversarial extraction.
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

    // Phase 1: Config-driven extraction
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
                const bodies = doc.querySelectorAll(sel);
                for (let i = bodies.length - 1; i >= 0; i--) {
                    const bodyContent = (bodies[i].innerText || '').trim();
                    if (bodyContent.length > 5) {
                        bodyText = bodyContent;
                        break;
                    }
                }
                if (bodyText) break;
            }
        } else if (client.iframeExtraction && doc.body) {
            // Iframe-based clients without a specific body selector: use full iframe body
            const clone = doc.body.cloneNode(true);
            clone.querySelectorAll('script, style').forEach(el => el.remove());
            bodyText = clone.innerText;
        }

        // Extract sender
        if (client.selectors.sender) {
            const senderSelectors = client.selectors.sender.split(',').map(s => s.trim());
            let senderEl = null;
            
            for (const sel of senderSelectors) {
                const all = document.querySelectorAll(sel);
                if (all.length > 0) { senderEl = all[all.length - 1]; break; }
            }
            if (!senderEl && doc !== document) {
                for (const sel of senderSelectors) {
                    const all = doc.querySelectorAll(sel);
                    if (all.length > 0) { senderEl = all[all.length - 1]; break; }
                }
            }

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
            if (subj) subject = (subj.innerText || subj.textContent || '').trim();
        }
    } catch (e) {
        console.warn(`[Hydra Guard] ${client.label} extraction failed:`, e);
    }

    // Phase 2: Robust Parser Fallbacks (BUG-146)
    // Each fallback is in its own try/catch so a failure in one does not
    // prevent the others from running. (M-3)

    // Body fallback: only fires when Phase 1 found NOTHING. (M-2)
    // This prevents Phase 1's short-but-valid content from being replaced
    // by potentially noisier parser.js output.
    try {
        if (bodyText.length === 0) {
            const fallbackBody = extractEmailText();
            // M-1: Reject results that look like Gmail UI chrome (sidebar, nav labels).
            // These appear when the email is image-only and parser.js falls through
            // to the Tier 2/3 document.body scrape.
            const looksLikeUIChrome = fallbackBody && UI_NOISE_PREFIXES.some(w =>
                fallbackBody.trimStart().startsWith(w)
            );
            if (fallbackBody && fallbackBody.length > 0 && !looksLikeUIChrome) {
                console.log('[Hydra Guard] extractEmailData: parser.js body fallback triggered');
                bodyText = fallbackBody;
            } else if (looksLikeUIChrome) {
                console.warn('[Hydra Guard] extractEmailData: parser.js body fallback rejected (UI chrome detected)');
            }
        }
    } catch (bodyFallbackErr) {
        console.warn('[Hydra Guard] Parser.js body fallback error:', bodyFallbackErr);
    }

    // Sender fallback: only fires when Phase 1 found no valid email address.
    try {
        if (!senderEmail || !senderEmail.includes('@')) {
            const fallbackSender = parseSenderInfo();
            if (fallbackSender.email && fallbackSender.email.includes('@')) {
                console.log('[Hydra Guard] extractEmailData: parser.js sender fallback triggered');
                senderName = fallbackSender.name || senderName;
                senderEmail = fallbackSender.email;
            }
        }
    } catch (senderFallbackErr) {
        console.warn('[Hydra Guard] Parser.js sender fallback error:', senderFallbackErr);
    }

    // Subject fallback: only fires when Phase 1 found no subject text.
    try {
        if (!subject) {
            const fallbackSubject = extractSubject();
            if (fallbackSubject && fallbackSubject !== 'Unknown Subject') {
                console.log('[Hydra Guard] extractEmailData: parser.js subject fallback triggered');
                subject = fallbackSubject;
            }
        }
    } catch (subjectFallbackErr) {
        console.warn('[Hydra Guard] Parser.js subject fallback error:', subjectFallbackErr);
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
